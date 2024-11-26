import json
import boto3
import redis
import os
from datetime import datetime
from boto3.dynamodb.conditions import Key
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
preferences_table = dynamodb.Table(os.environ['PREFERENCES_TABLE_NAME'])
party_table = dynamodb.Table(os.environ['PARTY_TABLE_NAME'])
movies_table = dynamodb.Table(os.environ['MOVIES_TABLE_NAME'])

# Initialize Redis client
redis_client = redis.Redis(
    host=os.environ['REDIS_HOST'],
    port=6379,
    decode_responses=True
)

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError

def select_movies(event, context):
    """
    Select movies for Suite 3 based on party preferences
    """
    try:
        party_id = event['pathParameters']['party_id']
        
        # Get party info
        party_response = party_table.get_item(Key={'party_id': party_id})
        if 'Item' not in party_response:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Party not found'})
            }
        
        party = party_response['Item']
        streaming_services = party['streaming_services']
        
        # Get all preferences from party members
        preferences_response = preferences_table.query(
            IndexName='PartyIndex',
            KeyConditionExpression=Key('party_id').eq(party_id)
        )
        
        # Aggregate preferences
        genre_preferences = set()
        genre_dealbreakers = set()
        decade_preferences = set()
        year_cutoff = None
        
        for pref in preferences_response['Items']:
            prefs = pref['preferences']
            # Add genre preferences
            genre_preferences.update(prefs.get('genre_preferences', []))
            # Add dealbreakers (only need one person to veto)
            genre_dealbreakers.update(prefs.get('genre_dealbreakers', []))
            # Add decade preferences
            decade_preferences.update(prefs.get('decade_preferences', []))
            # Get most restrictive year cutoff
            user_cutoff = prefs.get('year_cutoff')
            if user_cutoff and (not year_cutoff or user_cutoff > year_cutoff):
                year_cutoff = user_cutoff
        
        # Cache these preferences in Redis for quick access
        redis_key = f"preferences:{party_id}"
        redis_client.hmset(redis_key, {
            'genre_preferences': json.dumps(list(genre_preferences)),
            'genre_dealbreakers': json.dumps(list(genre_dealbreakers)),
            'decade_preferences': json.dumps(list(decade_preferences)),
            'year_cutoff': str(year_cutoff) if year_cutoff else ''
        })
        
        # After the existing preference aggregation code, add:
        
        # Get Suite 2 ratings for this party
        suite2_preferences = preferences_table.query(
            IndexName='PartyIndex',
            KeyConditionExpression=Key('party_id').eq(party_id),
            FilterExpression='suite_number = :suite_num',
            ExpressionAttributeValues={
                ':suite_num': 2
            }
        )
        
        # Calculate average ratings per movie
        movie_ratings = {}
        for pref in suite2_preferences.get('Items', []):
            if 'movie_ratings' in pref.get('preferences', {}):
                for rating in pref['preferences']['movie_ratings']:
                    movie_id = rating['movie_id']
                    if movie_id not in movie_ratings:
                        movie_ratings[movie_id] = {'total': 0, 'count': 0}
                    movie_ratings[movie_id]['total'] += rating['rating']
                    movie_ratings[movie_id]['count'] += 1
        
        # Define scan parameters
        scan_kwargs = {
            'FilterExpression': 'size(streaming_platforms) > :zero',
            'ExpressionAttributeValues': {':zero': 0}
        }

        # Modify the movie selection logic to include ratings
        selected_movies = []
        rated_movies = []
        unrated_movies = []
        
        response = movies_table.scan(**scan_kwargs)
        for movie in response['Items']:
            # Skip if movie is in dealbreaker genre
            if any(genre in movie['genres'] for genre in genre_dealbreakers):
                continue
                
            # Skip if movie is too old
            if year_cutoff and movie['year'] < year_cutoff:
                continue
                
            # Skip if movie isn't available on party's streaming services
            movie_platforms = {p['platform'] for p in movie['streaming_platforms']}
            if not any(service in movie_platforms for service in streaming_services):
                continue
                
            # Calculate base match score
            match_score = sum([
                any(genre in movie['genres'] for genre in genre_preferences) * 2,  # Genre match worth 2 points
                str(movie['year'])[:3] + '0' in decade_preferences  # Decade match worth 1 point
            ])
            
            # Add rating score if available
            movie_rating = movie_ratings.get(movie['movie_id'])
            if movie_rating and movie_rating['count'] > 0:
                avg_rating = movie_rating['total'] / movie_rating['count']
                match_score += (avg_rating / 2)  # Rating from 1-10 divided by 2 (max 5 points)
                rated_movies.append((movie, match_score))
            else:
                unrated_movies.append((movie, match_score))
        
        # Sort movies by match score
        rated_movies.sort(key=lambda x: x[1], reverse=True)
        unrated_movies.sort(key=lambda x: x[1], reverse=True)
        
        # Combine lists, prioritizing rated movies
        selected_movies = [m[0] for m in rated_movies[:3]]  # Take top 3 rated movies
        remaining_slots = 5 - len(selected_movies)
        if remaining_slots > 0:
            selected_movies.extend([m[0] for m in unrated_movies[:remaining_slots]])  # Fill remaining slots
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'selected_movies': selected_movies
            }, default=decimal_default)
        }
        
    except Exception as e:
        print(f"Error selecting movies: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not select movies'})
        }

def get_selected_movies(event, context):
    """
    Get the previously selected movies for a party
    """
    try:
        party_id = event['pathParameters']['party_id']
        
        # Try to get from Redis first
        movies_key = f"selected_movies:{party_id}"
        cached_movies = redis_client.lrange(movies_key, 0, -1)
        
        if cached_movies:
            movies = [json.loads(m) for m in cached_movies]
        else:
            # If not in Redis, return error as selections should be cached
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'No movies selected for this party'})
            }
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'selected_movies': movies
            }, default=decimal_default)
        }
        
    except Exception as e:
        print(f"Error getting selected movies: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not get selected movies'})
        }