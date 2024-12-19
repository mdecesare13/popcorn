# Databricks notebook source
# DBTITLE 1,AWS Sync Test
# Test AWS credentials and DynamoDB connection
import boto3

def test_aws_connection():
    try:
        # Initialize DynamoDB client with credentials
        AWS_ACCESS_KEY = dbutils.secrets.get("popcorn", "aws-access-key")
        AWS_SECRET_KEY = dbutils.secrets.get("popcorn", "aws-secret-key")
        
        dynamodb = boto3.client(
            'dynamodb',
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
            region_name='us-east-1'
        )
        
        # Try to describe the table
        response = dynamodb.describe_table(TableName='popcorn-movies')
        print("Successfully connected to DynamoDB!")
        print(f"Table status: {response['Table']['TableStatus']}")
        
    except Exception as e:
        print(f"Error connecting to DynamoDB: {str(e)}")

# Run the test
test_aws_connection()

# COMMAND ----------

# Databricks notebook source
import boto3
from decimal import Decimal
import json
from datetime import datetime
from typing import Dict, Any, List
import time

# AWS Configuration
def get_aws_client():
    """Initialize boto3 DynamoDB client with credentials from Databricks secrets."""
    AWS_ACCESS_KEY = dbutils.secrets.get("popcorn", "aws-access-key")
    AWS_SECRET_KEY = dbutils.secrets.get("popcorn", "aws-secret-key")
    AWS_REGION = "us-east-1"
    
    return boto3.client(
        'dynamodb',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

# COMMAND ----------

def convert_to_dynamo_format(movie: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Delta Lake movie record to DynamoDB format."""
    
    # Helper function to handle Decimal conversion
    def convert_number(n):
        if isinstance(n, (int, float)):
            return Decimal(str(n))
        return n
    
    # Convert ratings to DynamoDB format with Map type
    ratings = []
    for rating in movie.get('ratings', []):
        ratings.append({
            'M': {  # Each rating is a Map
                'source': {'S': rating[0]},
                'score': {'N': str(rating[1])},
                'max_score': {'N': str(rating[2])}
            }
        })
    
    # Convert streaming platforms to DynamoDB format with Map type
    platforms = []
    for platform in movie.get('streaming_platforms', []):
        platform_item = {
            'M': {  # Each platform is a Map
                'platform': {'S': platform[0]}
            }
        }
        if platform[1]:  # URL is optional
            platform_item['M']['url'] = {'S': platform[1]}
        platforms.append(platform_item)
    
    # Debug logging
    print(f"Converting movie: {movie['title']}")
    if movie.get('year') is None:
        print(f"WARNING: No year for movie {movie['title']}")
    for rating in movie.get('ratings', []):
        if None in (rating[1], rating[2]):
            print(f"WARNING: None values in ratings for {movie['title']}: {rating}")

    return {
        'movie_id': {'S': str(movie['movie_id'])},
        'title': {'S': movie['title']},
        'year': {'N': str(movie['year'])} if movie.get('year') is not None else {'NULL': True},
        'genres': {'L': [{'S': genre} for genre in movie.get('genres', [])]},
        'image_url': {'S': movie['image_url']} if movie.get('image_url') else {'NULL': True},
        'summary': {'S': movie['summary']} if movie.get('summary') else {'NULL': True},
        'content_rating': {'S': movie['content_rating']} if movie.get('content_rating') else {'NULL': True},
        'ratings': {'L': ratings},
        'streaming_platforms': {'L': platforms},
        'last_updated': {'S': datetime.now().isoformat()}
    }

# COMMAND ----------

def batch_write_to_dynamo(dynamo_client, items: List[Dict[str, Any]], table_name: str):
    """Write items to DynamoDB in batches."""
    BATCH_SIZE = 25  # DynamoDB maximum batch size
    
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i + BATCH_SIZE]
        request_items = {
            table_name: [{'PutRequest': {'Item': item}} for item in batch]
        }
        
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            try:
                response = dynamo_client.batch_write_item(RequestItems=request_items)
                
                # Handle unprocessed items
                unprocessed = response.get('UnprocessedItems', {})
                if not unprocessed:
                    break
                    
                # If there are unprocessed items, retry them
                request_items = unprocessed
                retry_count += 1
                time.sleep(2 ** retry_count)  # Exponential backoff
                
            except Exception as e:
                print(f"Error in batch {i//BATCH_SIZE}: {str(e)}")
                retry_count += 1
                if retry_count == max_retries:
                    raise
                time.sleep(2 ** retry_count)
        
        # Log progress
        print(f"Processed {min(i + BATCH_SIZE, len(items))} of {len(items)} items")

# COMMAND ----------

def sync_movies_to_dynamo():
    """Main function to sync Delta table movies to DynamoDB."""
    try:
        print("Starting movie sync to DynamoDB...")
        
        # Get DynamoDB client
        dynamo_client = get_aws_client()
        
        # Read from Delta table
        movies_df = spark.table("popcorn.movies")
        movies_df = movies_df.filter("""
            year IS NOT NULL 
            AND size(streaming_platforms) > 0
            AND title != ''
            AND size(genres) > 0
            AND image_url IS NOT NULL
            AND summary != ''
            AND size(ratings) > 0
            AND content_rating IS NOT NULL
        """) # to avoid null values
        print(movies_df.count())
        
        # Convert to list of dictionaries
        movies = movies_df.collect()
        movies_list = [movie.asDict() for movie in movies]
        
        # Convert to DynamoDB format
        dynamo_items = [convert_to_dynamo_format(movie) for movie in movies_list]
        
        print(f"Preparing to sync {len(dynamo_items)} movies to DynamoDB...")
        
        # Write to DynamoDB
        batch_write_to_dynamo(
            dynamo_client, 
            dynamo_items,
            "popcorn-movies"
        )
        
        print("Sync completed successfully!")
        print(f"Total movies synced: {len(dynamo_items)}")
        
    except Exception as e:
        print(f"Error during sync: {str(e)}")
        raise

# COMMAND ----------

# DBTITLE 1,EXECUTE
# For manual execution
if __name__ == "__main__":
    sync_movies_to_dynamo()

# COMMAND ----------

# DBTITLE 1,IF YOU WANT TO CLEAR THE TABLE
def clear_dynamodb_table():
    """Clear all items from the movies table."""
    try:
        # Get AWS credentials from secrets
        AWS_ACCESS_KEY = dbutils.secrets.get("popcorn", "aws-access-key")
        AWS_SECRET_KEY = dbutils.secrets.get("popcorn", "aws-secret-key")
        AWS_REGION = "us-east-1"
        
        # Create DynamoDB resource
        dynamo = boto3.resource(
            'dynamodb',
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
            region_name=AWS_REGION
        )
        
        table = dynamo.Table('popcorn-movies')
        
        # Scan all items with pagination
        items = []
        last_evaluated_key = None
        
        while True:
            if last_evaluated_key:
                response = table.scan(ExclusiveStartKey=last_evaluated_key)
            else:
                response = table.scan()
                
            items.extend(response.get('Items', []))
            
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break
        
        print(f"Deleting {len(items)} items...")
        
        # Delete items in batches
        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(
                    Key={
                        'movie_id': item['movie_id']
                    }
                )
        
        print("Successfully cleared movies table")
        
    except Exception as e:
        print(f"Error clearing table: {str(e)}")
        raise

clear_dynamodb_table()