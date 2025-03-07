import json
import boto3
import redis
import os
from decimal import Decimal
from common.logging_util import init_logger

# Add this class for JSON serialization
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super(DecimalEncoder, self).default(obj)

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
    Update a party's status, current suite, and/or participant progress
    """
    # initialize logger
    logger = init_logger('update_party_status', event)

    try:
        # Extract party_id from path parameters
        party_id = event['pathParameters']['party_id']
        # Extract update fields from body
        body = json.loads(event['body'])
        
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

        # Handle party status update
        if 'status' in body and 'current_suite' in body:
            # Validate status value
            valid_statuses = ['lobby', 'active', 'inactive']
            if body['status'] not in valid_statuses:
                logger.warn('Invalid status value', {
                    'party_id': party_id,
                    'status': body['status']
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
            
            party['status'] = body['status']
            party['current_suite'] = body['current_suite']

            # Update Redis for party status
            redis_key = f"party:{party_id}"
            redis_client.hmset(redis_key, {
                'status': body['status'],
                'current_suite': str(body['current_suite'])
            })

        # Handle participant progress update
        if 'user_id' in body and 'progress' in body:
            user_id = body['user_id']
            progress_update = body['progress']
            
            # Find and update the participant's progress
            for participant in party['participants']:
                if participant['user_id'] == user_id:
                    participant['progress'] = progress_update
                    participant['status'] = progress_update.get('status', participant.get('status', ''))
                    break
            else:
                logger.warn('User not found in party', {
                    'party_id': party_id,
                    'user_id': user_id
                })
                return {
                    'statusCode': 404,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Credentials': True
                    },
                    'body': json.dumps({'error': 'User not found in party'})
                }

        # Update party in DynamoDB
        party_table.put_item(Item=party)
        
        logger.info('Party updated successfully', {
            'party_id': party_id,
            'updates': body
        })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps(party, cls=DecimalEncoder)
        }
        
    except Exception as e:
        logger.error('Failed to update party', {'error': str(e)})
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({'error': 'Could not update party'})
        }