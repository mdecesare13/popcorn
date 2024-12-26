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
        
        # Query preferences using GSI
        logger.info("Querying preferences table using PartyIndex GSI")
        response = preferences_table.query(
            IndexName='PartyIndex',
            KeyConditionExpression=Key('party_id').eq(party_id),
            FilterExpression=Attr('suite_number').eq(1)
        )
        
        if not response.get('Items'):
            logger.error(f"No Suite 1 preferences found for party {party_id}")
            raise Exception(f"No Suite 1 preferences found for party {party_id}")
        
        logger.info(f"Found {len(response['Items'])} preference records for party")
        
        # Aggregate preferences across all party members
        genre_preferences = set()
        genre_dealbreakers = set()
        decade_preferences = set()
        year_cutoff = None
        
        for pref in response['Items']:
            prefs = pref.get('preferences', {})
            user_id = pref.get('user_id', 'unknown')
            logger.info(f"Processing preferences for user: {user_id}")
            
            # Log individual user preferences
            user_genres = prefs.get('genre_preferences', [])
            user_dealbreakers = prefs.get('genre_dealbreakers', [])
            logger.info(f"User {user_id} preferences - Genres: {user_genres}, Dealbreakers: {user_dealbreakers}")
            
            genre_preferences.update(user_genres)
            genre_dealbreakers.update(user_dealbreakers)
            decade_preferences.update(prefs.get('decade_preferences', []))
            
            # Take the most restrictive year cutoff
            user_cutoff = prefs.get('year_cutoff')
            if user_cutoff:
                logger.info(f"User {user_id} year cutoff: {user_cutoff}")
                if not year_cutoff or user_cutoff > year_cutoff:
                    year_cutoff = user_cutoff
        
        aggregated_preferences = {
            'genre_preferences': list(genre_preferences),
            'genre_dealbreakers': list(genre_dealbreakers),
            'decade_preferences': list(decade_preferences),
            'year_cutoff': year_cutoff
        }
        
        logger.info("Aggregated party preferences:")
        logger.info(f"Genre preferences: {aggregated_preferences['genre_preferences']}")
        logger.info(f"Genre dealbreakers: {aggregated_preferences['genre_dealbreakers']}")
        logger.info(f"Decade preferences: {aggregated_preferences['decade_preferences']}")
        logger.info(f"Year cutoff: {aggregated_preferences['year_cutoff']}")
        
        return aggregated_preferences
    except Exception as e:
        logger.error(f"Error getting party preferences: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def get_matching_movies(preferences: Dict[str, Any], logger) -> List[Dict[str, Any]]:
    """Get movies that match ALL party preferences."""
    try:
        logger.info("Starting movie matching process")
        movies_table = dynamodb.Table(os.environ['MOVIES_TABLE_NAME'])
        matching_movies = []
        
        # Start with scan since we need to check multiple conditions
        logger.info("Scanning movies table for matches")
        response = movies_table.scan()
        movies = response['Items']
        
        # Add pagination support for large datasets
        while 'LastEvaluatedKey' in response:
            logger.info("Fetching additional page of movies")
            response = movies_table.scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            movies.extend(response['Items'])
        
        logger.info(f"Retrieved {len(movies)} total movies to process")
        
        for movie in movies:
            # Log every 100 movies processed
            if len(matching_movies) % 100 == 0:
                logger.info(f"Processed {len(matching_movies)} matching movies so far")
            
            # Check year cutoff
            if preferences['year_cutoff'] and movie['year'] < preferences['year_cutoff']:
                continue
                
            # Check decade preferences
            movie_decade = str(movie['year'])[:3] + '0'
            if preferences['decade_preferences'] and \
               movie_decade not in preferences['decade_preferences']:
                continue
            
            # Check genre preferences (movie should have at least one preferred genre)
            movie_genres = set(movie['genres'])
            if preferences['genre_preferences'] and \
               not any(genre in movie_genres for genre in preferences['genre_preferences']):
                continue
            
            # Check dealbreakers (movie should have none of these genres)
            if any(genre in movie_genres for genre in preferences['genre_dealbreakers']):
                continue
            
            matching_movies.append(movie)
        
        logger.info(f"Found {len(matching_movies)} total matching movies")
        logger.info("Sample of matched movies:")
        for movie in matching_movies[:5]:
            logger.info(f"- {movie['title']} ({movie['year']})")
        
        return matching_movies
    except Exception as e:
        logger.error(f"Error getting matching movies: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def get_random_movies(count: int, logger) -> List[Dict[str, Any]]:
    """Get a random selection of movies from the database."""
    try:
        logger.info(f"Getting {count} random movies")
        movies_table = dynamodb.Table(os.environ['MOVIES_TABLE_NAME'])
        
        # Get all movie IDs
        logger.info("Fetching all movie IDs")
        response = movies_table.scan(
            ProjectionExpression='movie_id',
            Select='SPECIFIC_ATTRIBUTES'
        )
        
        movie_ids = [item['movie_id'] for item in response['Items']]
        logger.info(f"Found {len(movie_ids)} total movies in database")
        
        # Randomly select desired number of movies
        selected_ids = random.sample(movie_ids, min(count, len(movie_ids)))
        logger.info(f"Randomly selected {len(selected_ids)} movie IDs")
        
        # Get full movie data for selected IDs
        movies = []
        for movie_id in selected_ids:
            logger.info(f"Fetching details for movie_id: {movie_id}")
            response = movies_table.get_item(
                Key={'movie_id': movie_id}
            )
            if 'Item' in response:
                movies.append(response['Item'])
                logger.info(f"Retrieved movie: {response['Item']['title']}")
            else:
                logger.info(f"Movie {movie_id} not found in database")
        
        logger.info(f"Successfully retrieved {len(movies)} random movies")
        logger.info("Sample of random movies:")
        for movie in movies[:5]:
            logger.info(f"- {movie['title']} ({movie['year']})")
        
        return movies
    except Exception as e:
        logger.error(f"Error getting random movies: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def select_movies_with_openai(movies: List[Dict[str, Any]], preferences: Dict[str, Any], logger) -> List[Dict[str, Any]]:
    """Use OpenAI to select the best 5 movies from the candidate list."""
    try:
        logger.info("Initializing OpenAI client")
        client = OpenAI(
            api_key=get_openai_api_key(logger),
            timeout=120.0
        )
        
        # Create minimal movie choices text
        logger.info(f"Preparing prompt with {len(movies)} movies")
        movie_choices = "\n".join([
            f"- ID:{movie['movie_id']} - {movie['title']} ({movie['year']}) - Genres: {', '.join(movie['genres'])}" 
            for movie in movies
        ])
        
        # Create prompt
        prompt = f"""Given these user preferences:
        Genre preferences: {preferences['genre_preferences']}
        Genre dealbreakers: {preferences['genre_dealbreakers']}
        Decade preferences: {preferences['decade_preferences']}
        Year cutoff: {preferences['year_cutoff']}

        And these movie options:
        {movie_choices}

        Select exactly 5 movies that best match the preferences. Only select from the provided movies. You must ONLY select IDs that appear exactly as shown in the list above (the number after 'ID:'). Do not modify or generate new IDs.
        Respond with a JSON array of exactly 5 movie IDs (only the number after 'ID:').

        Example response format:
        {{
            "selected_movies": ["123", "456", "789", "012", "345"]
        }}"""
        
        logger.info("Calling OpenAI API")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a movie expert helping select films that match user preferences."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        # Parse OpenAI response
        logger.info("Processing OpenAI response")
        selections = json.loads(response.choices[0].message.content)['selected_movies']
        logger.info(f"OpenAI selected movies: {selections}")
        
        # Get full movie data for selected titles
        logger.info("Matching selected titles to movie data")
        selected_movies = [
            movie for movie in movies 
            if movie['movie_id'] in selections
        ]
        
        if len(selected_movies) < 5:
            logger.info(f"OpenAI only matched {len(selected_movies)} movies, returning available matches")
        elif len(selected_movies) > 5:
            logger.info("More than 5 matches found, returning top 5")
            selected_movies = selected_movies[:5]
        
        logger.info("Final selected movies:")
        for movie in selected_movies:
            logger.info(f"- {movie['title']} ({movie['year']})")
        
        return selected_movies
        
    except Exception as e:
        logger.error(f"Error in OpenAI selection: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        raise

def lambda_handler(event, context):
    """
    Main Lambda handler for Suite 2 movie selection.
    Returns 5 movies that match party preferences.
    """
    logger = init_logger('suite2-movie-selection', event)
    try:
        # Get party ID from event
        party_id = event['pathParameters']['party_id']
        logger.info(f"Starting movie selection for party: {party_id}")
        
        # Get party preferences
        logger.info("Fetching party preferences")
        preferences = get_party_preferences(party_id, logger)
        logger.info(f"Retrieved preferences")
        
        # Get matching movies
        logger.info("Finding movies matching preferences")
        matching_movies = get_matching_movies(preferences, logger)
        logger.info(f"Found {len(matching_movies)} matching movies")
        
        # If we have too few matching movies, get random selection
        if len(matching_movies) < 10:
            logger.info(f"Only found {len(matching_movies)} matching movies, falling back to random selection")
            matching_movies = get_random_movies(500, logger)
            logger.info("Successfully fetched random movies")
        
        # Use OpenAI to select final movies
        logger.info("Starting OpenAI movie selection")
        selected_movies = select_movies_with_openai(matching_movies, preferences, logger)
        logger.info(f"Successfully selected {len(selected_movies)} movies")
        
        # Handle Decimal serialization
        logger.info("Preparing response")
        selected_movies = json.loads(json.dumps(selected_movies, default=str))
        
        logger.info("Successfully completed movie selection")
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