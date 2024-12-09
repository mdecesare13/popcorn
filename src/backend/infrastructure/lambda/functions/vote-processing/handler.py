import json
import boto3
import redis
import os
from datetime import datetime
from common.logging_util import init_logger

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
votes_table = dynamodb.Table(os.environ['VOTES_TABLE_NAME'])
party_table = dynamodb.Table(os.environ['PARTY_TABLE_NAME'])

# Initialize Redis client
redis_client = redis.Redis(
    host=os.environ['REDIS_HOST'],
    port=6379,
    decode_responses=True
)

def submit_vote(event, context):
    """
    Submit a vote for a movie in Suite 3
    """

    logger = init_logger('submit_vote', event)

    try:
        body = json.loads(event['body'])
        party_id = body['party_id']
        user_id = body['user_id']
        movie_id = body['movie_id']
        vote = body['vote']  # 'yes', 'no', or 'seen'
        
        logger.info('Processing vote submission', {
            'party_id': party_id,
            'movie_id': movie_id,
            'user_id': user_id,
            'vote': vote
        })

        # Create unique vote ID
        vote_id = f"{party_id}#{user_id}#{movie_id}"
        
        # Save vote to DynamoDB
        vote_item = {
            'vote_id': vote_id,
            'party_id': party_id,
            'user_id': user_id,
            'movie_id': movie_id,
            'vote': vote,
            'timestamp': int(datetime.now().timestamp())
        }
        votes_table.put_item(Item=vote_item)
        
        # Update real-time counts in Redis
        redis_key = f"votes:{party_id}:{movie_id}"
        redis_client.hincrby(redis_key, vote, 1)
        redis_client.hincrby(redis_key, 'total', 1)
        
        logger.info('Vote saved successfully', {
            'vote_id': vote_id,
            'party_id': party_id,
            'movie_id': movie_id
        })

        # Check if all participants have voted
        party_response = party_table.get_item(Key={'party_id': party_id})
        if 'Item' in party_response:
            party = party_response['Item']
            total_participants = len(party['participants'])
            
            votes_count = int(redis_client.hget(redis_key, 'total') or 0)

            logger.info('Vote count status', {
                'party_id': party_id,
                'movie_id': movie_id,
                'votes_count': votes_count,
                'total_participants': total_participants
            })

            if votes_count >= total_participants:
                logger.info('All participants have voted', {
                    'party_id': party_id,
                    'movie_id': movie_id
                })

                # All votes are in for this movie
                redis_client.hset(f"party:{party_id}", 'voting_complete', 'true')
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'message': 'Vote recorded successfully',
                'vote_id': vote_id
            })
        }
        
    except Exception as e:
        logger.error('Failed to process vote', e, {
            'party_id': party_id if 'party_id' in locals() else None,
            'movie_id': movie_id if 'movie_id' in locals() else None
        })
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not process vote'})
        }

def get_votes(event, context):
    """
    Get current voting status for a party
    """

    logger = init_logger('get_vote_status', event)

    try:
        party_id = event['pathParameters']['party_id']
        movie_id = event['pathParameters']['movie_id']
        
        logger.info('Getting vote status', {
            'party_id': party_id,
            'movie_id': movie_id
        })

        # Get real-time vote counts from Redis
        redis_key = f"votes:{party_id}:{movie_id}"
        vote_counts = redis_client.hgetall(redis_key)

        logger.info('Found vote counts in Redis', {
            'party_id': party_id,
            'movie_id': movie_id,
            'vote_counts': vote_counts
        })

        # If no data in Redis, check DynamoDB
        if not vote_counts:
            logger.info('Vote counts not in cache, checking DynamoDB', {
                'party_id': party_id,
                'movie_id': movie_id
            })

            response = votes_table.query(
                KeyConditionExpression='party_id = :pid',
                FilterExpression='movie_id = :mid',
                ExpressionAttributeValues={
                    ':pid': party_id,
                    ':mid': movie_id
                }
            )
            
            if response['Items']:
                logger.info('Retrieved vote counts from DynamoDB', {
                    'party_id': party_id,
                    'movie_id': movie_id,
                    'total_votes': len(response['Items'])
                })
                vote_counts = {
                    'yes': sum(1 for item in response['Items'] if item['vote'] == 'yes'),
                    'no': sum(1 for item in response['Items'] if item['vote'] == 'no'),
                    'seen': sum(1 for item in response['Items'] if item['vote'] == 'seen'),
                    'total': len(response['Items'])
                }
                
                # Cache results in Redis
                redis_client.hmset(redis_key, vote_counts)
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'movie_id': movie_id,
                'vote_counts': vote_counts
            })
        }
        
    except Exception as e:
        logger.error('Failed to get vote status', e, {
            'party_id': party_id if 'party_id' in locals() else None,
            'movie_id': movie_id if 'movie_id' in locals() else None
        })
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not get vote status'})
        }