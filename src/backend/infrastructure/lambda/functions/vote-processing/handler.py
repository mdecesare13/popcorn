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

# Common CORS headers
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET',
    'Access-Control-Allow-Credentials': True
}

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
            'headers': CORS_HEADERS,
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
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Could not process vote'})
        }

def get_votes(event, context):
    """
    Get current voting status for all movies in a party
    """

    logger = init_logger('get_vote_status', event)

    try:
        party_id = event['pathParameters']['party_id']
        
        logger.info('Getting vote status for party', {
            'party_id': party_id
        })

        # Get all votes for this party using the new PartyIndex
        response = votes_table.query(
            IndexName='PartyIndex',  # Using our new GSI
            KeyConditionExpression='party_id = :pid',
            ExpressionAttributeValues={
                ':pid': party_id
            }
        )
        
        # Aggregate votes by movie
        vote_counts = {}
        for item in response['Items']:
            movie_id = item['movie_id']
            vote = item['vote']
            
            if movie_id not in vote_counts:
                vote_counts[movie_id] = {
                    'yes': 0,
                    'no': 0,
                    'seen': 0,
                    'total': 0
                }
            
            vote_counts[movie_id][vote] += 1
            vote_counts[movie_id]['total'] += 1

        logger.info('Vote counts aggregated', {
            'party_id': party_id,
            'vote_counts': vote_counts
        })
        
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'party_id': party_id,
                'vote_counts': vote_counts
            })
        }
        
    except Exception as e:
        logger.error('Failed to get vote status', e, {
            'party_id': party_id if 'party_id' in locals() else None
        })
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Could not get vote status'})
        }