import json
import boto3
import redis
import os
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from common.logging_util import init_logger

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
party_table = dynamodb.Table(os.environ['PARTY_TABLE_NAME'])
user_table = dynamodb.Table(os.environ['USER_TABLE_NAME'])

# Initialize Redis client
redis_client = redis.Redis(
    host=os.environ['REDIS_HOST'],
    port=6379,
    decode_responses=True
)

# Add this helper function at the top of the file
def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError

def create_party(event, context):
    """
    Create a new viewing party/lobby
    """

    # initialize logger
    logger = init_logger('create_party', event)

    try:
        body = json.loads(event['body'])
        host_name = body['host_name']
        streaming_services = body.get('streaming_services', [])
        
        # Generate IDs
        party_id = str(uuid.uuid4())
        host_id = str(uuid.uuid4())
        
        # Calculate TTL (24 hours from now)
        ttl = int((datetime.now() + timedelta(hours=24)).timestamp())
        
        # Create party entry in DynamoDB
        party_item = {
            'party_id': party_id,
            'host_id': host_id,
            'host_name': host_name,
            'created_at': int(datetime.now().timestamp()),
            'status': 'lobby',
            'streaming_services': streaming_services,
            'current_suite': 1,
            'participants': [{
                'user_id': host_id,
                'name': host_name,
                'status': 'active'
            }],
            'expires_at': ttl
        }
        
        # Save to DynamoDB
        party_table.put_item(Item=party_item)
        
        # Add to Redis for real-time access
        redis_key = f"party:{party_id}"
        redis_client.hmset(redis_key, {
            'host_id': host_id,
            'status': 'lobby',
            'current_suite': '1'
        })
        redis_client.expire(redis_key, 86400)  # 24 hours TTL
        
        logger.info('Party created successfully', {
            'party_id': party_id,
            'host_name': host_name,
            'num_streaming_services': len(streaming_services)
        })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'host_id': host_id,
                'status': 'lobby'
            })
        }
        
    except Exception as e:
        logger.error('Failed to create party', e)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'error': 'Could not create party'
            })
        }

def join_party(event, context):
    """
    Join an existing party/lobby
    """

    # initialize logger
    logger = init_logger('join_party', event)

    try:
        # Extract party_id from path parameters
        party_id = event['pathParameters']['party_id']
        # Extract user_name from body
        body = json.loads(event['body'])
        user_name = body['user_name']
        
        # Generate user ID
        user_id = str(uuid.uuid4())
        
        # Get party from DynamoDB
        party_response = party_table.get_item(Key={'party_id': party_id})
        if 'Item' not in party_response:
            logger.warn('Party not found for join request', {'party_id': party_id})
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Party not found'})
            }
            
        party = party_response['Item']
        if party['status'] != 'lobby':
            logger.warn('Attempted to join non-lobby party', {
                'party_id': party_id,
                'party_status': party['status']
            })
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Party is no longer accepting new participants'})
            }
            
        # Add user to participants
        party['participants'].append({
            'user_id': user_id,
            'name': user_name,
            'status': 'active'
        })
        
        # Update DynamoDB
        party_table.put_item(Item=party)
        
        # Update Redis
        redis_key = f"party:{party_id}"
        redis_client.hset(redis_key, f"user:{user_id}", 'active')
        
        logger.info('User joined party successfully', {
            'party_id': party_id,
            'user_id': user_id,
            'party_size': len(party['participants'])
        })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'user_id': user_id,
                'status': 'active'
            })
        }
        
    except Exception as e:
        logger.error('Failed to join party', e)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not join party'})
        }

# Then in get_party_status, update the return statement to use this serializer
def get_party_status(event, context):

    # initialize logger
    logger = init_logger('get_party_status', event)

    try:
        
        # More flexible parameter handling
        party_id = None
        if event.get('pathParameters'):
            party_id = event['pathParameters'].get('party_id')
        elif event.get('path'):
            # Try to extract from path if pathParameters not available
            path_parts = event['path'].split('/')
            party_id = path_parts[-1]
        
        # Add debug logging
        logger.info('Party status request received', {'party_id': party_id})
            
        if not party_id:
            logger.warn('Party status request missing party_id')
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Party ID not provided'})
            }
            
        # Get from DynamoDB first
        party_response = party_table.get_item(Key={'party_id': party_id})
        if 'Item' not in party_response:
            logger.warn('Party not found for status request', {'party_id': party_id})
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Party not found'})
            }
            
        party = party_response['Item']
        
        # Check Redis for real-time status
        redis_key = f"party:{party_id}"
        redis_status = redis_client.hgetall(redis_key)
        
        # Merge Redis status if available
        if redis_status:
            logger.info('Redis status merged with party data', {
                'party_id': party_id,
                'redis_keys': list(redis_status.keys())
            })
            party['real_time_status'] = redis_status
            
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'status': party['status'],
                'current_suite': party['current_suite'],
                'participants': party['participants']
            }, default=decimal_default)
        }
        
    except Exception as e:
        logger.error('Failed to get party status', e)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Could not get party status'})
        }