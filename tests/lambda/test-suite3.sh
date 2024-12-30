#!/bin/bash

API_ENDPOINT="https://7nocci82pj.execute-api.us-east-1.amazonaws.com/v2"

echo "1. Creating new party..."
CREATE_PARTY_RESPONSE=$(curl -s -X POST "${API_ENDPOINT}/party" \
  -H "Content-Type: application/json" \
  -d '{
    "host_name": "Test Host",
    "streaming_services": ["Netflix", "Hulu"]
  }')

echo "Create party response: $CREATE_PARTY_RESPONSE"
PARTY_ID=$(echo $CREATE_PARTY_RESPONSE | jq -r '.party_id')
HOST_ID=$(echo $CREATE_PARTY_RESPONSE | jq -r '.host_id')

echo "2. Adding user..."
USER_RESPONSE=$(curl -s -X PUT "${API_ENDPOINT}/party/${PARTY_ID}/join" \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Test User"
  }')

echo "Join party response: $USER_RESPONSE"
USER_ID=$(echo $USER_RESPONSE | jq -r '.user_id')

echo "3. Adding Suite 1 preferences..."
PREF_RESPONSE=$(curl -s -X PUT "${API_ENDPOINT}/party/${PARTY_ID}/preferences" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"genre_preferences\": [\"Action\", \"Comedy\"],
    \"genre_dealbreakers\": [\"Horror\"],
    \"decade_preferences\": [\"2010\", \"2020\"],
    \"year_cutoff\": 2000
  }")
echo "Preferences response: $PREF_RESPONSE"

echo "4. Getting Suite 2 movies..."
EVENT_JSON="{\"pathParameters\":{\"party_id\":\"${PARTY_ID}\"}}"

MOVIES_RESPONSE=$(aws lambda invoke \
  --function-name popcorn-suite2-movie-selection \
  --payload "$EVENT_JSON" \
  --cli-binary-format raw-in-base64-out \
  suite2_response.json)

echo "Suite 2 Response:"
if [ -f suite2_response.json ]; then
    cat suite2_response.json | jq .
else
    echo "No response file generated"
fi

echo "5. Submitting Suite 2 ratings..."
cat suite2_response.json | jq -r '.body' | jq '.movies[]' | jq -c '.' | while read -r MOVIE; do
  MOVIE_ID=$(echo $MOVIE | jq -r '.movie_id')
  echo "Rating movie: $MOVIE_ID"
  RATING_RESPONSE=$(curl -s -X PUT "${API_ENDPOINT}/party/${PARTY_ID}/rate/${MOVIE_ID}" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_id\": \"${USER_ID}\",
      \"rating\": 8
    }")
  echo "Rating response: $RATING_RESPONSE"
  sleep 1
done

echo "6. Getting Suite 3 movies..."
EVENT_JSON="{\"pathParameters\":{\"party_id\":\"${PARTY_ID}\"}}"

SUITE3_RESPONSE=$(aws lambda invoke \
  --function-name popcorn-suite3-movie-selection \
  --payload "$EVENT_JSON" \
  --cli-binary-format raw-in-base64-out \
  suite3_response.json)

echo "Suite 3 Response:"
if [ -f suite3_response.json ]; then
    cat suite3_response.json | jq .
else
    echo "No response file generated"
fi

echo "Test complete!"