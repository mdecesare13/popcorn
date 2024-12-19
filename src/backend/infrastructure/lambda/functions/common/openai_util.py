import os
import json
from typing import List, Dict, Any
import openai
from openai import OpenAI
from .logging_util import init_logger

logger = init_logger('openai_util')

class MovieRecommender:
    def __init__(self):
        self.client = OpenAI(
            api_key=os.environ['OPENAI_API_KEY'],
            max_retries=2,  # Retry twice on failures
            timeout=3.0     # 3 second timeout for 5s total Lambda limit
        )

    def _create_suite2_prompt(self, preferences: Dict[str, Any]) -> str:
        """Creates a prompt for Suite 2 movie selection."""
        return f"""You are a movie recommendation expert. Select 5 movies based on these preferences:
        Genre preferences: {preferences.get('genre_preferences', [])}
        Genre dealbreakers: {preferences.get('genre_dealbreakers', [])}
        Decade preferences: {preferences.get('decade_preferences', [])}
        Year cutoff: {preferences.get('year_cutoff')}

        Respond with exactly 5 movies in JSON format. Each movie must include:
        - title (exact match from TMDB)
        - year
        - brief rationale for selection

        Format:
        {
            "movies": [
                {
                    "title": "exact movie title",
                    "year": year as integer,
                    "rationale": "1-2 sentence explanation"
                }
            ]
        }"""

    def _create_suite3_prompt(self, preferences: Dict[str, Any], ratings: List[Dict[str, Any]]) -> str:
        """Creates a prompt for Suite 3 movie selection."""
        return f"""You are a movie recommendation expert. Select 5 NEW movies (different from previously rated ones) based on:
        Previous ratings: {json.dumps(ratings)}
        Genre preferences: {preferences.get('genre_preferences', [])}
        Genre dealbreakers: {preferences.get('genre_dealbreakers', [])}
        
        Respond with exactly 5 movies in JSON format. Include ONLY title and plot summary:
        {
            "movies": [
                {
                    "title": "exact movie title",
                    "plot": "2-3 sentence plot summary without revealing the title"
                }
            ]
        }"""

    async def get_suite2_recommendations(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Gets movie recommendations for Suite 2."""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo-1106",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You are a movie expert providing recommendations in JSON format."},
                    {"role": "user", "content": self._create_suite2_prompt(preferences)}
                ],
                temperature=0.7  # Some variety but not too random
            )
            
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise

    async def get_suite3_recommendations(self, 
                                       preferences: Dict[str, Any], 
                                       ratings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Gets movie recommendations for Suite 3."""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo-1106",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You are a movie expert providing recommendations in JSON format."},
                    {"role": "user", "content": self._create_suite3_prompt(preferences, ratings)}
                ],
                temperature=0.5  # More focused on highly rated preferences
            )
            
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise