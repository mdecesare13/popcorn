# Databricks notebook source
# DBTITLE 1,Source & Configuration
# Databricks notebook source
from datetime import datetime
from typing import List, Dict, Any
import requests
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, ArrayType, DoubleType, TimestampType
from pyspark.sql.functions import size
import pyspark.sql.functions as F

# COMMAND ----------

# Configuration
TMDB_API_KEY = dbutils.secrets.get("popcorn", "tmdb-api-key")
TMDB_ACCESS_TOKEN = dbutils.secrets.get("popcorn", "tmdb-access-token")
TMDB_BASE_URL = "https://api.themoviedb.org/3"
JUSTWATCH_BASE_URL = "https://api.justwatch.com/content"

# Update the headers for TMDB API calls to use the access token
TMDB_HEADERS = {
    "Authorization": f"Bearer {TMDB_ACCESS_TOKEN}",
    "accept": "application/json"
}

# Schema Definitions
movie_schema = StructType([
    StructField("movie_id", StringType(), False),
    StructField("title", StringType(), True),
    StructField("year", IntegerType(), True),
    StructField("genres", ArrayType(StringType()), True),
    StructField("image_url", StringType(), True),
    StructField("summary", StringType(), True),
    StructField("content_rating", StringType(), True),  # e.g., "PG-13", "R", etc.
    StructField("ratings", ArrayType(
        StructType([
            StructField("source", StringType(), True),
            StructField("score", DoubleType(), True),
            StructField("max_score", DoubleType(), True)
        ])
    ), True),
    StructField("streaming_platforms", ArrayType(
        StructType([
            StructField("platform", StringType(), True),
            StructField("url", StringType(), True)
        ])
    ), True),
    StructField("last_updated", TimestampType(), True)
])



# COMMAND ----------

# DBTITLE 1,TMDB FETCH movies
# COMMAND ----------

def fetch_movies_from_tmdb(page: int = 1) -> Dict[str, Any]:
    """
    Fetch popular movies from TMDB API.
    
    Args:
        page: Page number for pagination
        
    Returns:
        Dictionary containing movie data
    """
    url = f"{TMDB_BASE_URL}/movie/popular"
    params = {
        "page": page,
        "language": "en-US"
    }
    
    try:
        response = requests.get(url, headers=TMDB_HEADERS, params=params)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching movies: {e}")
        return None

# COMMAND ----------

# DBTITLE 1,TMDB FETCH release info (for content ratings)
# COMMAND ----------

def fetch_movie_release_info(movie_id: str) -> Dict[str, Any]:
    """
    Fetch US release dates and certifications for a specific movie.
    
    Args:
        movie_id: TMDB movie ID
        
    Returns:
        Dictionary containing release date information or None if error
    """
    url = f"{TMDB_BASE_URL}/movie/{movie_id}/release_dates"
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            response = requests.get(url, headers=TMDB_HEADERS)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            retry_count += 1
            if retry_count == max_retries:
                print(f"Failed to fetch release info for movie {movie_id} after {max_retries} attempts: {e}")
                return None
            print(f"Retry {retry_count} of {max_retries} for movie {movie_id}")
    return None

# COMMAND ----------

# DBTITLE 1,TMDB FETCH genres
# COMMAND ----------

def fetch_genre_list() -> Dict[int, str]:
    """
    Fetch list of movie genres from TMDB and create a mapping of ID to name.
    
    Returns:
        Dictionary mapping genre IDs to genre names
    """
    url = f"{TMDB_BASE_URL}/genre/movie/list"
    
    try:
        response = requests.get(url, headers=TMDB_HEADERS)
        response.raise_for_status()
        genres_data = response.json()
        
        # Create a mapping of genre_id to genre_name
        return {genre['id']: genre['name'] for genre in genres_data.get('genres', [])}
    except requests.RequestException as e:
        print(f"Error fetching genre list: {e}")
        return {}

# COMMAND ----------

# DBTITLE 1,TMDB FETCH streaming platforms
def fetch_streaming_availability(movie_id: str) -> List[Dict[str, str]]:
    """
    Fetch streaming availability using TMDB's watch providers endpoint.
    
    Args:
        movie_id: TMDB movie ID
        
    Returns:
        List of dictionaries containing platform information
    """
    url = f"{TMDB_BASE_URL}/movie/{movie_id}/watch/providers"
    
    # Platform name mapping for cleaner results
    platform_cleanup = {
        "Max Amazon Channel": "Max",
        "HBO Max": "Max",
        "Netflix Amazon Channel": "Netflix",
        "Hulu Amazon Channel": "Hulu",
        "Disney Plus": "Disney+",
        "Peacock Premium": "Peacock",
        "Peacock Premium Plus": "Peacock"
    }
    
    # List of platforms we want to include
    valid_platforms = {
        "Netflix", "Max", "Hulu", "Disney+", "Prime Video", 
        "Apple TV+", "Peacock", "Paramount+"
    }
    
    try:
        response = requests.get(url, headers=TMDB_HEADERS)
        response.raise_for_status()
        data = response.json()
        
        # Get US streaming data
        us_data = data.get('results', {}).get('US', {})
        
        # Get flatrate (subscription) streaming options
        streaming_platforms = []
        seen_platforms = set()  # To avoid duplicates
        
        # Combine flatrate and free options
        providers = us_data.get('flatrate', []) + us_data.get('free', [])
        
        for provider in providers:
            platform_name = provider.get('provider_name', '')
            # Clean up platform name if needed
            platform_name = platform_cleanup.get(platform_name, platform_name)
            
            # Only add if it's a valid streaming platform and we haven't seen it yet
            if platform_name in valid_platforms and platform_name not in seen_platforms:
                streaming_platforms.append({
                    "platform": platform_name,
                    "url": None  # We won't store URLs for MVP
                })
                seen_platforms.add(platform_name)
            
        return streaming_platforms
        
    except requests.RequestException as e:
        print(f"Error fetching streaming data for movie {movie_id}: {e}")
        return []

# COMMAND ----------

# DBTITLE 1,OMDb FETCH movie ratings
def fetch_omdb_data(title: str, year: int = None) -> Dict[str, Any]:
    """
    Fetch movie ratings from OMDB API.
    
    Args:
        title: Movie title
        year: Release year (optional)
        
    Returns:
        Dictionary containing rating information
    """
    OMDB_API_KEY = dbutils.secrets.get("popcorn", "omdb-api-key")
    OMDB_BASE_URL = "https://www.omdbapi.com/"  # Changed to https
    
    params = {
        'apikey': OMDB_API_KEY,
        't': title,
        'type': 'movie'
    }
    if year:
        params['y'] = year
        
    try:
        response = requests.get(OMDB_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data.get('Response') == 'True':
            ratings = []
            
            # Add IMDb rating if available
            if data.get('imdbRating') and data['imdbRating'] != 'N/A':
                ratings.append({
                    "source": "IMDB",
                    "score": float(data['imdbRating']),
                    "max_score": 10.0
                })
                
            # Add Rotten Tomatoes rating if available
            for rating in data.get('Ratings', []):
                if rating['Source'] == 'Rotten Tomatoes':
                    # Convert percentage to decimal
                    score = float(rating['Value'].replace('%', ''))
                    ratings.append({
                        "source": "Rotten Tomatoes",
                        "score": score,
                        "max_score": 100.0
                    })
                elif rating['Source'] == 'Metacritic':
                    # Convert "84/100" format to decimal
                    score = float(rating['Value'].split('/')[0])
                    ratings.append({
                        "source": "Metacritic",
                        "score": score,
                        "max_score": 100.0
                    })
            
            return ratings
        return []
        
    except (requests.RequestException, ValueError) as e:
        print(f"Error fetching OMDB data for {title} ({year}): {e}")
        return []

# COMMAND ----------

# DBTITLE 1,reformat Function
# COMMAND ----------

def transform_movie_data(raw_movies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Transform raw movie data into our schema format.
    
    Args:
        raw_movies: List of raw movie data from TMDB
        
    Returns:
        List of transformed movie dictionaries
    """
    # Fetch genre mapping once for all movies
    genre_mapping = fetch_genre_list()
    if not genre_mapping:
        print("Warning: Could not fetch genre mapping. Genre information will be limited.")
    
    transformed_movies = []
    failed_movies = []
    
    for movie in raw_movies:
        try:
            movie_id = str(movie.get("id", ""))
            if not movie_id:
                print("Skipping movie with no ID")
                continue
                
            release_info = fetch_movie_release_info(movie_id)
            
            # Get US rating if available, otherwise None
            content_rating = None
            if release_info and "results" in release_info:
                try:
                    us_release = next((r for r in release_info["results"] if r["iso_3166_1"] == "US"), None)
                    if us_release and us_release.get("release_dates"):
                        certifications = [rd.get("certification") for rd in us_release["release_dates"] 
                                        if rd.get("certification") and rd.get("certification").strip()]
                        content_rating = next(iter(certifications), None) if certifications else None
                except Exception as e:
                    print(f"Error processing certification for movie {movie_id}: {e}")
                    content_rating = None
            
            # Transform genre IDs to names
            genre_ids = movie.get("genre_ids", [])
            genres = [genre_mapping.get(genre_id) for genre_id in genre_ids if genre_id in genre_mapping]
            
            # Get streaming platforms
            streaming_platforms = fetch_streaming_availability(movie_id)

            # Get base TMDB rating
            ratings = [
                {
                    "source": "TMDB",
                    "score": movie.get("vote_average", 0.0),
                    "max_score": 10.0
                }
            ]
            
            # Get additional ratings from OMDB
            year = int(movie.get("release_date", "").split("-")[0]) if movie.get("release_date") else None
            omdb_ratings = fetch_omdb_data(movie.get("title", ""), year)
            ratings.extend(omdb_ratings)

            transformed = {
                "movie_id": movie_id,
                "title": movie.get("title", "Unknown Title"),
                "year": int(movie.get("release_date", "").split("-")[0]) if movie.get("release_date") else None,
                "genres": genres,  # Now populated with genre names
                "image_url": f"https://image.tmdb.org/t/p/w500{movie.get('poster_path')}" if movie.get("poster_path") else None,
                "summary": movie.get("overview", ""),
                "content_rating": content_rating,
                "ratings": ratings,  # Now includes TMDB, IMDB, Rotten Tomatoes, and Metacritic,
                "streaming_platforms": streaming_platforms,  # Now populated with actual data
                "last_updated": datetime.now()
            }
            transformed_movies.append(transformed)
            
        except Exception as e:
            failed_movies.append(movie_id)
            print(f"Error transforming movie {movie.get('id', 'unknown')}: {e}")
            continue
    
    if failed_movies:
        print(f"Failed to process {len(failed_movies)} movies: {failed_movies}")
    
    print(f"Successfully transformed {len(transformed_movies)} movies")
    return transformed_movies

# COMMAND ----------

# DBTITLE 1,main
# COMMAND ----------

def main(num_pages: int = 3):
    """
    Main ETL process for movie data.
    
    Args:
        num_pages: Number of pages of movies to fetch (20 movies per page)
    """
    print("Starting movie data ETL process...")
    all_transformed_movies = []
    
    try:
        for page in range(1, num_pages + 1):
            print(f"\nProcessing page {page} of {num_pages}...")
            
            # Fetch movies
            raw_data = fetch_movies_from_tmdb(page=page)
            if not raw_data or "results" not in raw_data:
                print(f"No movie data received for page {page}, skipping...")
                continue
                
            # Transform data
            transformed_movies = transform_movie_data(raw_data["results"])
            if transformed_movies:
                all_transformed_movies.extend(transformed_movies)
            
        if not all_transformed_movies:
            raise ValueError("No movies were successfully transformed")
        
        # Convert to DataFrame
        movies_df = spark.createDataFrame(all_transformed_movies, schema=movie_schema)
        
        # Deduplicate by movie_id, keeping the most recent data
        movies_df = movies_df.dropDuplicates(['movie_id'])
        
        print(f"\nWriting {movies_df.count()} movies to Delta table...")
        
        # Create temp view of new data
        movies_df.createOrReplaceTempView("movies_updates")
        
        # Merge into existing table
        spark.sql("""
            MERGE INTO popcorn.movies target
            USING (SELECT * FROM movies_updates) source
            ON target.movie_id = source.movie_id
            WHEN MATCHED THEN
                UPDATE SET *
            WHEN NOT MATCHED THEN
                INSERT *
        """)
        
        print("\nETL process completed successfully!")
        print(f"Total movies processed: {len(all_transformed_movies)}")
        
        # Get some statistics about streaming platforms
        movies_with_streaming = movies_df.filter(size("streaming_platforms") > 0)
        streaming_count = movies_with_streaming.count()
        
        # Get statistics about ratings
        movies_with_ratings = movies_df.filter(size("ratings") > 1)  # More than just TMDB rating
        ratings_count = movies_with_ratings.count()
        
        print(f"Movies with streaming data: {streaming_count} ({(streaming_count/len(all_transformed_movies)*100):.1f}%)")
        print(f"Movies with multiple ratings: {ratings_count} ({(ratings_count/len(all_transformed_movies)*100):.1f}%)")
        
    except Exception as e:
        print(f"Error in ETL process: {e}")
        raise

# COMMAND ----------

# DBTITLE 1,EXECUTE
# COMMAND ----------

# For manual execution
# This check ensures the main() function only runs when we explicitly execute this script, not when importing it elsewhere
if __name__ == "__main__":
    main()

# COMMAND ----------

# MAGIC %md
# MAGIC # BELOW HERE WILL BE A VARIETY OF TESTS THAT YOU CAN RUN

# COMMAND ----------

# DBTITLE 1,Test API connection
# COMMAND ----------

# Test API connection
test_response = fetch_movies_from_tmdb(page=1)
if test_response and 'results' in test_response:
    print(f"Successfully fetched {len(test_response['results'])} movies")
    print("\nFirst movie details:")
    print(f"Title: {test_response['results'][0]['title']}")
    print(f"Release Date: {test_response['results'][0]['release_date']}")
else:
    print("Error fetching movies")

# COMMAND ----------

# DBTITLE 1,Test the enhanced movie data fetching and transformation
# COMMAND ----------

# Test the enhanced movie data fetching and transformation
print("Testing movie data pipeline...")

# Fetch initial movie data
test_response = fetch_movies_from_tmdb(page=1)

if test_response and 'results' in test_response:
    # Transform the data
    transformed_data = transform_movie_data(test_response['results'])
    
    # Print some sample results
    print(f"\nProcessed {len(transformed_data)} movies")
    
    # Show details of first few movies
    for movie in transformed_data[:3]:  # First 3 movies
        print("\nMovie Details:")
        print(f"Title: {movie['title']}")
        print(f"Year: {movie['year']}")
        print(f"Content Rating: {movie['content_rating']}")
        print(f"TMDB Rating: {movie['ratings'][0]['score']}")
else:
    print("Error: Could not fetch movie data")



# COMMAND ----------

# DBTITLE 1,Test the enhanced movie data fetching and transformation with genres
# COMMAND ----------

# Test the enhanced movie data fetching and transformation with genres
print("Testing movie data pipeline with genres...")

# Fetch initial movie data
test_response = fetch_movies_from_tmdb(page=1)

if test_response and 'results' in test_response:
    # Transform the data
    transformed_data = transform_movie_data(test_response['results'])
    
    # Print some sample results
    print(f"\nProcessed {len(transformed_data)} movies")
    
    # Show details of first few movies
    for movie in transformed_data[:3]:  # First 3 movies
        print("\nMovie Details:")
        print(f"Title: {movie['title']}")
        print(f"Year: {movie['year']}")
        print(f"Genres: {', '.join(movie['genres'])}")
        print(f"Content Rating: {movie['content_rating']}")
        print(f"TMDB Rating: {movie['ratings'][0]['score']}")
else:
    print("Error: Could not fetch movie data")



# COMMAND ----------

# DBTITLE 1,Test streaming availability
# COMMAND ----------

# Test streaming availability with TMDB for a known older movie
print("Testing streaming availability with TMDB...")

def fetch_specific_movie(title: str) -> Dict[str, Any]:
    """
    Fetch a specific movie by title from TMDB.
    """
    url = f"{TMDB_BASE_URL}/search/movie"
    params = {
        "query": title,
        "language": "en-US"
    }
    
    try:
        response = requests.get(url, headers=TMDB_HEADERS, params=params)
        response.raise_for_status()
        data = response.json()
        return data['results'][0] if data.get('results') else None
    except Exception as e:
        print(f"Error fetching movie: {e}")
        return None

# Test with "The Matrix" (1999)
test_movie = fetch_specific_movie("The Invitation")

if test_movie:
    movie_id = str(test_movie['id'])
    print(f"\nFetching streaming platforms for: {test_movie['title']} ({test_movie['release_date']})")
    streaming_data = fetch_streaming_availability(movie_id)
    
    if streaming_data:
        print("Available on:")
        for platform in streaming_data:
            print(f"- {platform['platform']}")
    else:
        print("No streaming platforms found or movie not available for streaming")
else:
    print("Error: Could not fetch movie data")

# COMMAND ----------

# DBTITLE 1,Test OMBD Integration
# COMMAND ----------

# Test OMDB integration with ratings processing
print("Testing OMDB ratings processing...")

test_ratings = fetch_omdb_data("The Dark Knight", 2008)
print("\nRatings for The Dark Knight:")
for rating in test_ratings:
    print(f"- {rating['source']}: {rating['score']}/{rating['max_score']}")

# COMMAND ----------

# DBTITLE 1,Test after running main()
# MAGIC %sql
# MAGIC -- COMMAND ----------
# MAGIC
# MAGIC SELECT * 
# MAGIC FROM popcorn.movies
# MAGIC LIMIT 10;