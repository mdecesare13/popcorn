import json
import boto3
import redis
import os
from common.logging_util import init_logger

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
party_table = dynamodb.Table(os.environ['PARTY_TABLE_NAME'])

# Initialize Redis client
redis_client = redis.Redis(
    host=os.environ['REDIS_HOST'],
    port=6379,
    decode_responses=True
)

def update_party_status(event, context):
    """
    Update a party's status and current suite
    """
    # initialize logger
    logger = init_logger('update_party_status', event)

    try:
        # Extract party_id from path parameters
        party_id = event['pathParameters']['party_id']
        # Extract update fields from body
        body = json.loads(event['body'])
        
        # Validate required fields
        if 'status' not in body or 'current_suite' not in body:
            logger.warn('Missing required fields in update request', {
                'party_id': party_id,
                'body': body
            })
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': True
                },
                'body': json.dumps({
                    'error': 'Both status and current_suite are required'
                })
            }

        new_status = body['status']
        new_suite = body['current_suite']
        
        # Validate status value
        valid_statuses = ['lobby', 'active', 'inactive']
        if new_status not in valid_statuses:
            logger.warn('Invalid status value', {
                'party_id': party_id,
                'status': new_status
            })
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': True
                },
                'body': json.dumps({
                    'error': f'Status must be one of: {", ".join(valid_statuses)}'
                })
            }
        
        # Get current party data
        party_response = party_table.get_item(Key={'party_id': party_id})
        if 'Item' not in party_response:
            logger.warn('Party not found for update request', {'party_id': party_id})
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': True
                },
                'body': json.dumps({'error': 'Party not found'})
            }
        
        party = party_response['Item']
        
        # Update party in DynamoDB
        party['status'] = new_status
        party['current_suite'] = new_suite
        party_table.put_item(Item=party)
        
        # Update Redis
        redis_key = f"party:{party_id}"
        redis_client.hmset(redis_key, {
            'status': new_status,
            'current_suite': str(new_suite)
        })
        
        logger.info('Party updated successfully', {
            'party_id': party_id,
            'new_status': new_status,
            'new_suite': new_suite
        })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'party_id': party_id,
                'status': new_status,
                'current_suite': new_suite
            })
        }
        
    except Exception as e:
        logger.error('Failed to update party', e)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({'error': 'Could not update party'})
        }