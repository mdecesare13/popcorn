# Popcorn

## Overview

Popcorn is a web application designed to solve the age-old problem of groups spending more time choosing what to watch than actually watching. The app helps friends collectively decide on a movie to watch through a structured, multi-phase voting system enhanced by AI recommendations.

Users move through three distinct phases:
1. **Initial preference collection** - Gather genre preferences, dealbreakers, and year/decade preferences
2. **Individual movie rating** - Rate suggested movies on a 1-10 scale
3. **Blind movie voting** - Vote yes/no on movies without seeing titles (only plot summaries)

The app uses AI to process group preferences and deliver personalized movie recommendations that satisfy the entire group.

## Demo Video

[![Popcorn App Demo](https://img.youtube.com/vi/YOUTUBE_VIDEO_ID/maxresdefault.jpg)](https://drive.google.com/file/d/1KTd4YgqAycdf6c6bqLga0VSMRA_UTE5v/view?usp=drive_link)

## Features

- **Private viewing parties** - Create movie selection sessions with shareable links
- **Streaming service filtering** - Only suggest movies available on your subscribed platforms
- **Preference reconciliation** - Balances diverse preferences to find movies everyone will enjoy
- **Blind voting** - Helps eliminate bias based on actors, directors, or titles
- **Deadlock prevention** - Built-in tie-breaking and "already seen" handling
- **AI-powered recommendations** - Leverages AI to suggest movies matching group preferences

## Tech Stack

### Backend
- **AWS Lambda** - Serverless functions for business logic
- **DynamoDB** - NoSQL database for user data, preferences, and voting records
- **Redis** - State management and caching
- **OpenAI API** - AI-powered movie recommendations
- **Databricks** - ETL processes and movie data management

### Frontend
- **Next.js** - React framework for server-side rendering and static site generation
- **TypeScript** - Type-safe JavaScript for improved developer experience
- **Tailwind CSS** - Utility-first CSS framework for responsive design
- **React Query** - Data fetching and state management
- **Framer Motion** - Animation library for smooth UI transitions
- **Vercel** - Deployment and hosting platform

## Architecture

Popcorn follows a modern serverless architecture with distinct components:

```[Movie Data Pipeline]      [User Interaction]
        |                         |
[Databricks ETL] -----> [AWS Infrastructure] <----- [Frontend]
        |                         |                    
[Delta Lake/DynamoDB]    [Lambda Functions]       
                               |
                        [Redis Cache]
```

### Data Flow
1. Users create parties and submit preferences
2. Preferences are stored in DynamoDB and processed by Lambda functions
3. Redis handles state management
4. OpenAI API provides intelligent movie recommendations based on preferences
5. Lambda functions process votes and determine the winning movie

## Backend Implementation

The backend implementation is divided into several key components:

### 1. Infrastructure (AWS)

All infrastructure is defined as code using CloudFormation templates:

- **Core Infrastructure** - Base IAM roles and Lambda layers
- **DynamoDB Tables** - Database tables for parties, preferences, votes, and movies
- **Redis Cache** - In-memory caching for state management
- **Lambda Functions** - Serverless business logic
- **API Gateway** - REST API endpoints

### 2. Data Storage

**DynamoDB Tables:**
- `popcorn-party-info` - Party/session management with host details
- `popcorn-user-preferences` - User preferences from phases 1 & 2
- `popcorn-final-votes` - Phase 3 voting records
- `popcorn-movies` - Movie metadata

**Redis Cache:**
- Party state caching
- Movie selection caching
- Rating and voting result caching

### 3. Lambda Functions

Core functions handling business logic:
- **Party Management** - Create/join parties, manage sessions
- **Movie Selection** - Process preferences, select matching movies
- **Rating System** - Process and store user ratings
- **Vote Processing** - Handle final voting, determine winners
- **OpenAI Integration** - Generate AI-powered recommendations

### 4. Movie Data Pipeline

Movie data is sourced from external APIs and processed in Databricks:
- ETL process fetches movie data
- Delta Lake tables store standardized movie information
- DynamoDB sync process updates movie data

## API Documentation

The Popcorn API is organized around REST principles with endpoints for party management, movie selection, rating, and voting.

Key endpoints include:

### Party Management
- `POST /party` - Create a new party
- `GET /party/{party_id}` - Get party details
- `PUT /party/{party_id}/join` - Join an existing party

### Preferences & Recommendations
- `PUT /party/{party_id}/preferences` - Submit phase 1 preferences
- `GET /party/{party_id}/suite2movies` - Get phase 2 movie recommendations
- `GET /party/{party_id}/suite3movies` - Get phase 3 movie recommendations

### Rating & Voting
- `PUT /party/{party_id}/rate/{movie_id}` - Submit movie rating
- `PUT /party/{party_id}/vote` - Submit movie vote
- `GET /party/{party_id}/votes` - Get voting results

## Frontend Implementation

### Structure

The frontend is built with Next.js using the App Router pattern for efficient page routing and server components:

- **Home Page** - Landing page with party creation functionality
- **Suite Pages** - Three distinct interfaces for each phase of the selection process:
  - `/suite1/[id]` - Initial preference collection
  - `/suite2/[id]` - Individual movie rating
  - `/suite3/[id]` - Blind movie voting
- **Lobby** - Waiting room for participants before starting the process
- **Final Results** - Displays the winning movie with details

### Components

The UI is composed of reusable components:

- **Party Creation** - Form for creating new viewing parties
- **Preference Selectors** - Interactive UI for selecting genres, years, and platforms
- **Movie Cards** - Responsive cards displaying movie information
- **Rating Interface** - Interactive rating system with animations
- **Voting Interface** - Blind voting mechanism with plot summaries
- **Results Display** - Dynamic results visualization

### State Management

- **React Query** - Handles API requests, caching, and synchronization
- **React Context** - Manages global application state
- **Local Storage** - Persists user preferences and session information

### Responsive Design

The application is fully responsive, providing optimal experiences on:
- Desktop computers
- Tablets
- Mobile devices

### Deployment

The frontend is deployed on Vercel with:
- Continuous integration/continuous deployment
- Preview deployments for pull requests
- Analytics and performance monitoring