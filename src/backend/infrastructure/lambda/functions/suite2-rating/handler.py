import json
import boto3
import redis
import os
from datetime import datetime
from decimal import Decimal
from common.logging_util import init_logger

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
preferences_table = dynamodb.Table(os.environ['PREFERENCES_TABLE_NAME'])
party_table = dynamodb.Table(os.environ['PARTY_TABLE_NAME'])

# Initialize Redis client
redis_client = redis.Redis(
    host=os.environ['REDIS_HOST'],
    port=6379,
    decode_responses=True
)

def submit_rating(event, context):
    """
    Submit a rating (1-10) for a movie in Suite 2
    """

    logger = init_logger('submit_rating', event)
    
    try:
        # Get path parameters
        party_id = event['pathParameters']['party_id']
        movie_id = event['pathParameters']['movie_id']
        
        # Get other data from body
        body = json.loads(event['body'])
        user_id = body['user_id']
        rating = int(body['rating'])  # Rating from 1-10
        
        logger.info('Processing rating submission', {
            'party_id': party_id,
            'movie_id': movie_id,
            'user_id': user_id,
            'rating': rating
        })

        if not (1 <= rating <= 10):
            logger.warn('Invalid rating value', {
                'party_id': party_id,
                'movie_id': movie_id,
                'rating': rating
            })
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Rating must be between 1 and 10'})
            }
        
        # Create preference record
        preference_id = f"{party_id}#{user_id}#suite2"
        timestamp = int(datetime.now().timestamp())
        
        # Get existing preferences or create new
        response = preferences_table.get_item(Key={'preference_id': preference_id})
        existing_prefs = response.get('Item', {})
        
        # Initialize or update movie ratings
        current_ratings = existing_prefs.get('preferences', {}).get('movie_ratings', [])
        
        # Update or add new rating
        rating_updated = False
        for r in current_ratings:
            if r['movie_id'] == movie_id:
                r['rating'] = rating
                rating_updated = True
                break
                
        if not rating_updated:
            current_ratings.append({
                'movie_id': movie_id,
                'rating': rating
            })
        
        # Prepare complete preference item
        preference_item = {
            'preference_id': preference_id,
            'party_id': party_id,
            'user_id': user_id,
            'suite_number': 2,
            'preferences': {
                'movie_ratings': current_ratings
            },
            'timestamp': timestamp
        }
        
        # Save to DynamoDB
        preferences_table.put_item(Item=preference_item)
        
        # Update Redis for real-time access
        redis_key = f"suite2_ratings:{party_id}:{movie_id}"
        redis_client.hincrby(redis_key, 'total_ratings', 1)
        redis_client.hincrby(redis_key, 'sum_ratings', rating)
        
        logger.info('Rating saved successfully', {
            'party_id': party_id,
            'movie_id': movie_id,
            'preference_id': preference_id,
            'total_ratings': len(current_ratings)
        })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'message': 'Rating recorded successfully',
                'preference_id': preference_id
            })
        }
        
    except Exception as e:
        logger.error('Failed to submit rating', e, {
            'party_id': party_id if 'party_id' in locals() else None,
            'movie_id': movie_id if 'movie_id' in locals() else None
        })
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not submit rating'})
        }

def get_ratings(event, context):
    """
    Get ratings for a movie in Suite 2
    """

    logger = init_logger('get_ratings', event)

    try:
        party_id = event['pathParameters']['party_id']
        movie_id = event['pathParameters']['movie_id']
        
        logger.info('Getting ratings', {
            'party_id': party_id,
            'movie_id': movie_id
        })
        
        # Get real-time ratings from Redis
        redis_key = f"suite2_ratings:{party_id}:{movie_id}"
        ratings_data = redis_client.hgetall(redis_key)
        
        if ratings_data:
            logger.info('Found ratings in Redis cache', {
                'party_id': party_id,
                'movie_id': movie_id
            })
            total_ratings = int(ratings_data.get('total_ratings', 0))
            sum_ratings = int(ratings_data.get('sum_ratings', 0))
            avg_rating = sum_ratings / total_ratings if total_ratings > 0 else 0
        else:
            logger.info('Ratings not in cache, calculating from DynamoDB', {
                'party_id': party_id,
                'movie_id': movie_id
            })
            # If not in Redis, calculate from DynamoDB
            response = preferences_table.query(
                IndexName='PartyIndex',
                KeyConditionExpression='party_id = :pid',
                ExpressionAttributeValues={
                    ':pid': party_id
                }
            )
            
            ratings = []
            for item in response['Items']:
                if item.get('suite_number') == 2:
                    movie_ratings = item.get('preferences', {}).get('movie_ratings', [])
                    for r in movie_ratings:
                        if r['movie_id'] == movie_id:
                            ratings.append(r['rating'])
            
            total_ratings = len(ratings)
            avg_rating = sum(ratings) / total_ratings if ratings else 0
            
            # Cache in Redis
            if ratings:
                redis_client.hset(redis_key, 'total_ratings', total_ratings)
                redis_client.hset(redis_key, 'sum_ratings', sum(ratings))

            logger.info('Calculated ratings from DynamoDB', {
                'party_id': party_id,
                'movie_id': movie_id,
                'total_ratings': total_ratings,
                'average_rating': avg_rating
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'movie_id': movie_id,
                'total_ratings': total_ratings,
                'average_rating': avg_rating
            }, default=decimal_default)
        }
        
    except Exception as e:
        logger.error('Failed to get ratings', e, {
            'party_id': party_id if 'party_id' in locals() else None,
            'movie_id': movie_id if 'movie_id' in locals() else None
        })
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not get ratings'})
        }