import os
import json
import boto3
import random
from typing import List, Dict, Any
from botocore.exceptions import ClientError
from openai import OpenAI
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from common.logging_util import init_logger

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
secretsmanager = boto3.client('secretsmanager', region_name='us-east-1')

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def get_openai_api_key(logger):
    """Retrieve OpenAI API key from Secrets Manager."""
    try:
        secret_name = "popcorn/openai"
        logger.info(f"Fetching OpenAI API key from Secrets Manager: {secret_name}")
        response = secretsmanager.get_secret_value(SecretId=secret_name)
        logger.info("Successfully retrieved OpenAI API key from Secrets Manager")
        return response['SecretString']
    except ClientError as e:
        logger.error(f"Failed to get OpenAI API key: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error code: {e.response['Error']['Code'] if 'Error' in e.response else 'No error code'}")
        raise

def get_party_preferences(party_id: str, logger) -> Dict[str, Any]:
    """Get Suite 1 preferences for the party from DynamoDB."""
    try:
        logger.info(f"Getting Suite 1 preferences for party: {party_id}")
        preferences_table = dynamodb.Table(os.environ['PREFERENCES_TABLE_NAME'])
        
        response = preferences_table.query(
            IndexName='PartyIndex',
            KeyConditionExpression=Key('party_id').eq(party_id),
            FilterExpression=Attr('suite_number').eq(1)
        )
        
        if not response.get('Items'):
            logger.error(f"No Suite 1 preferences found for party {party_id}")
            raise Exception(f"No Suite 1 preferences found for party {party_id}")
        
        logger.info(f"Found {len(response['Items'])} preference records for party")
        
        # Aggregate preferences
        genre_preferences = set()
        genre_dealbreakers = set()
        decade_preferences = set()
        year_cutoff = None
        
        for pref in response['Items']:
            prefs = pref.get('preferences', {})
            genre_preferences.update(prefs.get('genre_preferences', []))
            genre_dealbreakers.update(prefs.get('genre_dealbreakers', []))
            decade_preferences.update(prefs.get('decade_preferences', []))
            
            user_cutoff = prefs.get('year_cutoff')
            if user_cutoff and (not year_cutoff or user_cutoff > year_cutoff):
                year_cutoff = user_cutoff
        
        return {
            'genre_preferences': list(genre_preferences),
            'genre_dealbreakers': list(genre_dealbreakers),
            'decade_preferences': list(decade_preferences),
            'year_cutoff': year_cutoff
        }
    except Exception as e:
        logger.error(f"Error getting party preferences: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def get_suite2_ratings(party_id: str, logger) -> Dict[str, Any]:
    """Get Suite 2 ratings for the party from DynamoDB."""
    try:
        logger.info(f"Getting Suite 2 ratings for party: {party_id}")
        preferences_table = dynamodb.Table(os.environ['PREFERENCES_TABLE_NAME'])
        
        response = preferences_table.query(
            IndexName='PartyIndex',
            KeyConditionExpression=Key('party_id').eq(party_id),
            FilterExpression=Attr('suite_number').eq(2)
        )
        
        if not response.get('Items'):
            logger.warn(f"No Suite 2 ratings found for party {party_id}")
            return {'rated_movies': set(), 'genre_ratings': {}}
        
        logger.info(f"Found {len(response['Items'])} rating records")
        
        # Track rated movies and genre performance
        rated_movies = set()
        genre_ratings = {}
        
        # Process all ratings
        for pref in response['Items']:
            movie_ratings = pref.get('preferences', {}).get('movie_ratings', [])
            
            for rating in movie_ratings:
                movie_id = rating.get('movie_id')
                rating_value = rating.get('rating', 0)
                rated_movies.add(movie_id)
                
                # Get movie genres
                movies_table = dynamodb.Table(os.environ['MOVIES_TABLE_NAME'])
                movie_response = movies_table.get_item(Key={'movie_id': movie_id})
                
                if 'Item' in movie_response:
                    movie = movie_response['Item']
                    genres = movie.get('genres', [])
                    
                    # Update genre ratings
                    for genre in genres:
                        if genre not in genre_ratings:
                            genre_ratings[genre] = {'total': 0, 'count': 0}
                        genre_ratings[genre]['total'] += rating_value
                        genre_ratings[genre]['count'] += 1
        
        # Calculate average ratings per genre
        for genre in genre_ratings:
            avg = genre_ratings[genre]['total'] / genre_ratings[genre]['count']
            genre_ratings[genre] = round(avg, 2)
        
        logger.info(f"Processed {len(rated_movies)} rated movies")
        logger.info(f"Genre rating averages: {genre_ratings}")
        
        return {
            'rated_movies': rated_movies,
            'genre_ratings': genre_ratings
        }
    except Exception as e:
        logger.error(f"Error getting Suite 2 ratings: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def get_matching_movies(preferences: Dict[str, Any], rated_movies: set, logger) -> List[Dict[str, Any]]:
    """Get movies matching preferences, excluding previously rated ones."""
    try:
        logger.info("Starting movie matching process")
        movies_table = dynamodb.Table(os.environ['MOVIES_TABLE_NAME'])
        matching_movies = []
        
        response = movies_table.scan()
        movies = response['Items']
        
        while 'LastEvaluatedKey' in response:
            response = movies_table.scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            movies.extend(response['Items'])
        
        logger.info(f"Retrieved {len(movies)} total movies to process")
        
        for movie in movies:
            # Skip if already rated
            if movie['movie_id'] in rated_movies:
                continue
                
            # Check year cutoff
            if preferences['year_cutoff'] and movie['year'] < preferences['year_cutoff']:
                continue
                
            # Check decade preferences
            movie_decade = str(movie['year'])[:3] + '0'
            if preferences['decade_preferences'] and \
               movie_decade not in preferences['decade_preferences']:
                continue
            
            # Check genre preferences
            movie_genres = set(movie['genres'])
            if preferences['genre_preferences'] and \
               not any(genre in movie_genres for genre in preferences['genre_preferences']):
                continue
            
            # Check dealbreakers
            if any(genre in movie_genres for genre in preferences['genre_dealbreakers']):
                continue
            
            matching_movies.append(movie)
        
        logger.info(f"Found {len(matching_movies)} matching movies (excluding rated ones)")
        
        # Sort movies by number of matching preferred genres to get most relevant ones
        matching_movies.sort(key=lambda m: len(set(m['genres']).intersection(set(preferences['genre_preferences']))), reverse=True)
        
        # Take top 50 most relevant movies only
        top_movies = matching_movies[:50]
        
        logger.info(f"Selected top {len(top_movies)} most relevant movies")
        logger.info("Sample of matched movies:")
        for movie in top_movies[:5]:
            logger.info(f"- {movie['title']} ({movie['year']})")
        
        return top_movies
    except Exception as e:
        logger.error(f"Error getting matching movies: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def select_movies_with_openai(movies: List[Dict[str, Any]], 
                            preferences: Dict[str, Any], 
                            genre_ratings: Dict[str, float],
                            logger) -> List[Dict[str, Any]]:
    """Use OpenAI to select movies based on preferences and previous ratings."""
    try:
        logger.info("Initializing OpenAI client")
        client = OpenAI(
            api_key=get_openai_api_key(logger),
            timeout=120.0
        )
        
        # Handle Decimal serialization for genre ratings
        logger.info("Serializing genre ratings")
        genre_ratings = json.loads(json.dumps(genre_ratings, default=str))
        
        # Create movie choices text with full info for model context
        movie_choices = "\n".join([
            f"- ID:{movie['movie_id']} - {movie['title']} ({movie['year']}) - Genres: {', '.join(movie['genres'])} - Summary: {movie.get('summary', 'No summary available')}" 
            for movie in movies
        ])
        
        # Create prompt including genre ratings
        prompt = f"""Given these user preferences and ratings:

        Genre preferences: {preferences['genre_preferences']}
        Genre dealbreakers: {preferences['genre_dealbreakers']}
        Decade preferences: {preferences['decade_preferences']}
        Year cutoff: {preferences['year_cutoff']}
        
        Previous genre ratings (1-10 scale):
        {json.dumps(genre_ratings, indent=2)}

        And these movie options:
        {movie_choices}

        Select exactly 5 movies that best match the preferences and previous ratings.
        Heavily weight your selection toward genres that received high ratings.
        Only select from the provided movies using their exact IDs.
        Do not select any animated movies, and do not select two movies from the same franchise.
        
        For each selected movie, provide a plot summary that doesn't reveal the movie title. Do not make a mistake and provide a plot summary for a movie different than the one you select. This is unacceptable.
        
        Respond with a JSON object containing:
        1. selected_movies: array of objects with movie_id and blind_summary
        
        Example response format:
        {{
            "selected_movies": [
                {{
                    "movie_id": "123",
                    "blind_summary": "A determined hero must save their world..."
                }},
                // ... more movies
            ]
        }}"""
        
        logger.info("Calling OpenAI API")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-1106",
            messages=[
                {"role": "system", "content": "You are a movie expert helping select films based on user preferences and past ratings."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        # Parse OpenAI response
        logger.info("Processing OpenAI response")
        result = json.loads(response.choices[0].message.content)
        
        # Create full movie objects with blind summaries
        selected_movies = []
        for selection in result['selected_movies']:
            movie = next((m for m in movies if m['movie_id'] == selection['movie_id']), None)
            if movie:
                # Create complete movie object with all data plus blind summary
                selected_movie = movie.copy()  # Keep all original movie data
                selected_movie['blind_summary'] = selection['blind_summary']  # Add blind summary
                selected_movies.append(selected_movie)
        
        logger.info(f"Returning {len(selected_movies)} complete movie objects with blind summaries")
        return selected_movies
        
    except Exception as e:
        logger.error(f"Error in OpenAI selection: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def convert_decimals(obj, to_float=True):
    if isinstance(obj, dict):
        return {k: convert_decimals(v, to_float) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(x, to_float) for x in obj]
    elif isinstance(obj, Decimal):
        return float(obj) if to_float else obj
    elif isinstance(obj, float):
        return obj if to_float else Decimal(str(obj))
    return obj

def lambda_handler(event, context):
    """
    Main Lambda handler for Suite 3 movie selection.
    Returns 5 movies with full details plus blind summaries for voting.
    """
    logger = init_logger('suite3-movie-selection', event)
    try:
        # Get party ID from event
        party_id = event['pathParameters']['party_id']
        logger.info(f"Starting Suite 3 movie selection for party: {party_id}")
        
        # Get party preferences
        preferences = get_party_preferences(party_id, logger)
        
        # Get Suite 2 ratings
        ratings_data = get_suite2_ratings(party_id, logger)
        rated_movies = ratings_data['rated_movies']
        genre_ratings = ratings_data['genre_ratings']
        
        # Get matching movies (excluding rated ones)
        matching_movies = get_matching_movies(preferences, rated_movies, logger)
        
        # Handle Decimal serialization for matching movies
        logger.info("Serializing matching movies")
        matching_movies = json.loads(json.dumps(matching_movies, default=str))
        
        if len(matching_movies) < 5:
            logger.error(f"Insufficient matching movies: {len(matching_movies)}")
            raise Exception("Not enough matching movies available for selection")
        
        # Use OpenAI to select final movies
        selected_movies = select_movies_with_openai(
            matching_movies, 
            preferences,
            genre_ratings,
            logger
        )
        
        # Handle Decimal serialization for final response
        logger.info("Preparing final response")
        selected_movies = convert_decimals(selected_movies, to_float=True)
        selected_movies = json.loads(json.dumps(selected_movies))
        
        # Store selected movies in party data
        party_table = dynamodb.Table('popcorn-party-info')
        party_response = party_table.get_item(Key={'party_id': party_id})
        if 'Item' not in party_response:
            raise Exception('Party not found')
        
        party = party_response['Item']
        party['movies_suite3'] = convert_decimals(selected_movies, to_float=False)
        party_table.put_item(Item=party)

        logger.info('Stored selected movies in party data', {
            'party_id': party_id,
            'num_movies': len(selected_movies)
        })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({
                'movies': selected_movies
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({
                'error': str(e),
                'message': 'Error processing request'
            })
        }