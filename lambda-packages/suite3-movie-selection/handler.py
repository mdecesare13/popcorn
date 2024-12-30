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
        return matching_movies
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
        
        Respond with a JSON object containing:
        1. selected_movie_ids: array of exactly 5 movie IDs
        2. plot_summaries: array of 5 plot summaries that don't reveal the movie titles

        Example response format:
        {{
            "selected_movie_ids": ["123", "456", "789", "012", "345"],
            "plot_summaries": [
                "A determined hero must save their world...",
                "Two unlikely friends discover...",
                ...
            ]
        }}"""
        
        logger.info("Calling OpenAI API")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-1106",  # Sufficient for preference analysis and within token limits
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
        selections = result['selected_movie_ids']
        plot_summaries = result['plot_summaries']
        
        logger.info(f"OpenAI selected {len(selections)} movies")
        
        # Get selected movies and add blind summaries
        selected_movies = []
        for i, movie_id in enumerate(selections):
            movie = next((m for m in movies if m['movie_id'] == movie_id), None)
            if movie:
                # Create a clean version with only necessary info
                selected_movies.append({
                    'movie_id': movie['movie_id'],
                    'plot_summary': plot_summaries[i]
                })
        
        logger.info(f"Returning {len(selected_movies)} movies for voting")
        return selected_movies
        
    except Exception as e:
        logger.error(f"Error in OpenAI selection: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def lambda_handler(event, context):
    """
    Main Lambda handler for Suite 3 movie selection.
    Returns 5 movies (with only plot summaries) for blind voting.
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
        
        logger.info("Successfully completed Suite 3 movie selection")
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
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
            'body': json.dumps({
                'error': str(e),
                'message': 'Error processing request'
            })
        }