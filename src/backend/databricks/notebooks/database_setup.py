-- Databricks notebook source
-- DBTITLE 1,Creating Movies Table
-- Create the popcorn database if it doesn't exist
CREATE DATABASE IF NOT EXISTS popcorn;

-- Set popcorn as the default database for subsequent queries
USE popcorn;

-- Create movies table
CREATE TABLE IF NOT EXISTS movies (
    movie_id STRING,
    title STRING,
    year INT,
    genres ARRAY<STRING>,
    image_url STRING,
    summary STRING,
    ratings ARRAY<STRUCT<
        source: STRING,
        score: DOUBLE,
        max_score: DOUBLE
    >>,
    streaming_platforms ARRAY<STRUCT<
        platform: STRING,
        url: STRING
    >>,
    last_updated TIMESTAMP,
    CONSTRAINT pk_movie PRIMARY KEY (movie_id)
)
USING DELTA;

-- COMMAND ----------

-- DBTITLE 1,Creating Party Info
-- Create party_info table to store lobby/party data
CREATE TABLE IF NOT EXISTS popcorn.party_info (
    party_id STRING,
    host_id STRING,
    host_name STRING,
    streaming_services ARRAY<STRING>,
    created_at TIMESTAMP,
    status STRING,  -- 'active', 'in_progress', 'completed', etc.
    completed_at TIMESTAMP,
    CONSTRAINT pk_party PRIMARY KEY (party_id)
)
USING DELTA;

-- COMMAND ----------

-- DBTITLE 1,Creating User Feedback
-- Create user_feedback table to store all suite responses
CREATE TABLE IF NOT EXISTS popcorn.user_info (
    preference_id STRING,
    party_id STRING,
    user_id STRING,
    user_name STRING,
    suite_number INT,
    preference_type STRING,  -- e.g., 'genre_preference', 'genre_dealbreaker', 'decade_preference', etc.
    preference_value STRING, -- Store all preferences as strings, we can parse based on preference_type
    created_at TIMESTAMP,
    CONSTRAINT pk_preference PRIMARY KEY (preference_id),
    CONSTRAINT fk_party FOREIGN KEY (party_id) REFERENCES party_info(party_id)
)
USING DELTA;

-- COMMAND ----------

-- DBTITLE 1,Checking Existence
show tables in popcorn