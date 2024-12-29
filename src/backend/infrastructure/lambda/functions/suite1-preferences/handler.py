import json
import os
import boto3
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
preferences_table = dynamodb.Table(os.environ['PREFERENCES_TABLE_NAME'])

def init_logger(handler_name: str, event: Dict = None) -> Any:
    """Initialize logger with context."""
    # Placeholder for logging util - would normally import from common
    class SimpleLogger:
        def error(self, msg, error=None, context=None):
            print(f"ERROR: {msg}")
            if error:
                print(f"Error details: {str(error)}")
        def info(self, msg, context=None):
            print(f"INFO: {msg}")
    return SimpleLogger()

logger = init_logger('suite1_preferences')

def validate_preferences(preferences: Dict[str, Any]) -> bool:
    """
    Validates the preferences according to the rules:
    - Exactly 2 genre preferences
    - Exactly 1 genre dealbreaker
    - Exactly 2 decade preferences
    - Year cutoff must be one of the allowed values
    """
    try:
        # Validate genre preferences
        genre_prefs = preferences.get('genre_preferences', [])
        if not isinstance(genre_prefs, list) or len(genre_prefs) != 2:
            return False

        # Validate genre dealbreakers
        dealbreakers = preferences.get('genre_dealbreakers', [])
        if not isinstance(dealbreakers, list) or len(dealbreakers) != 1:
            return False

        # Validate decade preferences
        decade_prefs = preferences.get('decade_preferences', [])
        if not isinstance(decade_prefs, list) or len(decade_prefs) != 2:
            return False

        # Validate year cutoff
        year_cutoff = preferences.get('year_cutoff')
        valid_years = [2020, 2010, 2000, 1990, 1980, 1970, 1960]
        if not isinstance(year_cutoff, (int, float)) or year_cutoff not in valid_years:
            return False

        return True
    except Exception as e:
        logger.error(f"Error validating preferences: {str(e)}")
        return False

def store_preferences(
    party_id: str,
    user_id: str,
    preferences: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Stores the validated preferences in DynamoDB.
    """
    timestamp = int(datetime.now().timestamp())
    
    preference_item = {
        'preference_id': f"{party_id}#{user_id}#suite1",
        'party_id': party_id,
        'user_id': user_id,
        'suite_number': 1,
        'preferences': {
            'genre_preferences': preferences['genre_preferences'],
            'genre_dealbreakers': preferences['genre_dealbreakers'],
            'decade_preferences': preferences['decade_preferences'],
            'year_cutoff': preferences['year_cutoff']
        },
        'timestamp': timestamp,
        'expires_at': timestamp + 86400  # 24 hour TTL
    }
    
    try:
        preferences_table.put_item(Item=preference_item)
        return preference_item
    except Exception as e:
        logger.error(f"Error storing preferences: {str(e)}")
        raise

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for storing Suite 1 preferences.
    """
    try:
        # Log invocation
        logger.info("Processing Suite 1 preferences request", {'event': event})
        
        # Parse request
        body = json.loads(event['body'])
        party_id = event['pathParameters']['party_id']
        user_id = body['user_id']
        
        # Extract preferences
        preferences = {
            'genre_preferences': body['genre_preferences'],
            'genre_dealbreakers': body['genre_dealbreakers'],
            'decade_preferences': body['decade_preferences'],
            'year_cutoff': body['year_cutoff']
        }
        
        # Validate preferences
        if not validate_preferences(preferences):
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': True
                },
                'body': json.dumps({
                    'error': 'Invalid preferences format. Please check the requirements.'
                })
            }
        
        # Store preferences
        stored_preferences = store_preferences(party_id, user_id, preferences)
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'message': 'Preferences stored successfully',
                'preferences': stored_preferences
            }, default=str)  # Handle datetime serialization
        }
        
    except KeyError as e:
        logger.error(f"Missing required field: {str(e)}")
        return {
            'statusCode': 400,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'error': f'Missing required field: {str(e)}'
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'error': 'Internal server error'
            })
        }