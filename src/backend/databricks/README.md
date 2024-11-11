# Popcorn Databricks Implementation

## Notebooks
- database_setup.py: Delta table creation and schema setup
- movie_data_etl.py: Movie data pipeline implementation

## Environment Setup
1. Databricks workspace required
2. Secrets needed:
   - tmdb-api-key
   - tmdb-access-token
   - omdb-api-key

## Manual ETL Process
Run movie_data_etl.py notebook to:
1. Fetch movie data from TMDB
2. Get additional ratings from OMDB
3. Update Delta tables
