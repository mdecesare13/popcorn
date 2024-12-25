import os
import json
import boto3
import random
from botocore.exceptions import ClientError
from openai import OpenAI
from decimal import Decimal
from common.logging_util import init_logger

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
secretsmanager = boto3.client('secretsmanager', region_name='us-east-1')

def get_openai_api_key(logger):
    """Retrieve OpenAI API key from Secrets Manager."""
    try:
        secret_name = "popcorn/openai"
        logger.info(f"Fetching secret: {secret_name}")
        response = secretsmanager.get_secret_value(SecretId=secret_name)
        logger.info("Successfully fetched secret")
        return response['SecretString']
    except ClientError as e:
        logger.error(f"Error getting secret: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error code: {e.response['Error']['Code'] if 'Error' in e.response else 'No error code'}")
        raise

def get_random_movie(logger):
    """Get a random movie from DynamoDB."""
    try:
        table = dynamodb.Table('popcorn-movies')
        
        # Get all movie IDs first (this is fine for small dataset)
        response = table.scan(
            ProjectionExpression='movie_id',
            Select='SPECIFIC_ATTRIBUTES'
        )
        
        # Randomly select one movie ID
        movie_ids = [item['movie_id'] for item in response['Items']]
        random_id = random.choice(movie_ids)
        
        # Get the full movie data for the selected ID
        response = table.get_item(
            Key={'movie_id': random_id}
        )
        
        if 'Item' not in response:
            raise Exception("No movie found")
            
        return response['Item']
    except ClientError as e:
        logger.error(f"Error accessing DynamoDB: {str(e)}")
        raise

def generate_alternate_summary(movie_title, original_summary, logger):
    """Generate an alternative plot summary using OpenAI."""
    try:
        logger.info("Getting OpenAI API key")
        client = OpenAI(
            api_key=get_openai_api_key(logger),
            timeout=120.0  # Increased from 3.0
        )
        
        logger.info("Creating OpenAI prompt")
        prompt = f"""Given the movie "{movie_title}", rewrite this plot summary in a different style:
        Original: {original_summary}
        
        Provide a new 2-3 sentence summary that captures the same key points but with different wording.
        """
        
        logger.info("Calling OpenAI API")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a movie expert who writes engaging plot summaries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        
        logger.info("Successfully got OpenAI response")
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}")
        raise

def lambda_handler(event, context):
    """Main Lambda handler."""
    logger = init_logger('openai-test', event)
    try:
        # Get random movie
        movie = get_random_movie(logger)
        logger.info(f"Selected movie: {movie['title']}")
        
        # Generate alternative summary
        alternate_summary = generate_alternate_summary(
            movie['title'],
            movie['summary'],
            logger
        )
        logger.info("Generated alternate summary successfully")
        
        # Handle Decimal serialization
        movie = json.loads(json.dumps(movie, default=str))
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'movie': movie,
                'alternate_summary': alternate_summary,
                'message': 'Successfully generated alternate summary'
            })
        }
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Error processing request'
            })
        }