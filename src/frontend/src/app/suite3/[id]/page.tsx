'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

// Types
interface Movie {
  movie_id: string;
  year: number;
  image_url: string;
  blind_summary: string;
  ratings: {
    source: string;
    score: string;
    max_score: string;
  }[];
}

interface Vote {
  movie_id: string;
  vote: 'yes' | 'no' | null;
}

export default function Suite3Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  const [movies, setMovies] = useState<Movie[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Add new state for animation
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initial setup and validation
  useEffect(() => {
    const validateAndSetup = async () => {
      try {
        // Get party details first
        const partyResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!partyResponse.ok) {
          throw new Error('Failed to fetch party details');
        }

        const partyData = await partyResponse.json();
        const isHostUser = userId === partyData.participants[0]?.user_id;
        setIsHost(isHostUser);
        
        if (partyData.status !== 'active' || partyData.current_suite !== 3) {
          router.push(`/suite3/lobby/${params.id}?userId=${userId}`);
          return;
        }

        // Get movies from localStorage with retry for non-hosts
        const getMoviesWithRetry = async (retries = 3, delay = 2000) => {
          for (let i = 0; i < retries; i++) {
            const savedMovies = window.localStorage.getItem(`party_${params.id}_suite3_movies`);
            if (savedMovies) {
              const moviesData = JSON.parse(savedMovies);
              setMovies(moviesData);
              setVotes(moviesData.map((movie: Movie) => ({
                movie_id: movie.movie_id,
                vote: null
              })));
              setIsLoadingMovies(false);
              return true;
            }

            // If no movies in localStorage, try fetching them
            try {
              const moviesResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/suite3movies`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (moviesResponse.ok) {
                const moviesData = await moviesResponse.json();
                window.localStorage.setItem(`party_${params.id}_suite3_movies`, JSON.stringify(moviesData.movies));
                setMovies(moviesData.movies);
                setVotes(moviesData.movies.map((movie: Movie) => ({
                  movie_id: movie.movie_id,
                  vote: null
                })));
                setIsLoadingMovies(false);
                return true;
              }
            } catch (error) {
              console.error('Failed to fetch movies:', error);
            }

            if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          return false;
        };

        if (isHostUser) {
          // Host should already have movies in localStorage from lobby
          const success = await getMoviesWithRetry(1, 0); // Single immediate check
          if (!success) {
            router.push(`/suite3/lobby/${params.id}?userId=${userId}`);
            return;
          }
        } else {
          // Non-hosts retry a few times
          const success = await getMoviesWithRetry();
          if (!success) {
            router.push(`/suite3/lobby/${params.id}?userId=${userId}`);
            return;
          }
        }
        
        // Add to initial useEffect after party validation
        if (partyData.status === 'active' && partyData.current_suite === 3) {
          // Update user progress to show they've started Suite 3
          await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userId,
                progress: {
                  status: 'in_suite_3',
                  current_suite: 3,
                  completed_suites: ['suite_1', 'suite_2'],
                  last_updated: new Date().toISOString()
                }
              })
            }
          );
        }
        
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id && userId) validateAndSetup();
  }, [params.id, userId, router]);

  // Handle vote change
  const handleVoteChange = (movieId: string, newVote: 'yes' | 'no') => {
    setVotes(prev => 
      prev.map(vote => 
        vote.movie_id === movieId 
          ? { ...vote, vote: newVote } 
          : vote
      )
    );
  };

  // Submit all votes
  const handleSubmit = async () => {
    // Check for missing votes and highlight them
    const missing = votes
      .filter(vote => vote.vote === null)
      .map(vote => vote.movie_id);
    
    if (missing.length > 0) {
      // Scroll to first missing vote
      const firstMissingElement = document.getElementById(`movie-${missing[0]}`);
      if (firstMissingElement) {
        firstMissingElement.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      // Submit each vote
      for (let i = 0; i < votes.length; i++) {
        const vote = votes[i];
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/vote`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              party_id: params.id,
              user_id: userId,
              movie_id: vote.movie_id,
              vote: vote.vote
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to submit vote ${i + 1}`);
        }
      }

      // If host, update party status
      if (isHost) {
        const updateResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'lobby',
              current_suite: 4
            }),
          }
        );

        if (!updateResponse.ok) {
          throw new Error('Failed to update party status');
        }
      }

      // Store the full movie information for the final page
      window.localStorage.setItem(`party_${params.id}_final_movies`, JSON.stringify(movies));

      // Clear suite3 specific storage
      window.localStorage.removeItem(`party_${params.id}_suite3_movies`);

      // Add to handleSubmit before redirect
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            progress: {
              status: 'completed_suite_3',
              current_suite: 3,
              completed_suites: ['suite_1', 'suite_2', 'suite_3'],
              last_updated: new Date().toISOString()
            }
          })
        }
      );

      // Redirect to final lobby
      router.push(`/final/lobby/${params.id}?userId=${userId}`);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  // Navigation functions
  const nextMovie = () => {
    if (currentMovieIndex < movies.length - 1) {
      setCurrentMovieIndex(prev => prev + 1);
    }
  };

  const previousMovie = () => {
    if (currentMovieIndex > 0) {
      setCurrentMovieIndex(prev => prev - 1);
    }
  };

  if (!isMounted) return null;  // Prevent hydration issues

  if (isLoading || isLoadingMovies) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#151a24] text-white">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#151a24] text-white">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden font-['SF_Pro_Display',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-[url('/images/cinema-background.jpg')] bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%)"
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center py-12 px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-7xl font-medium tracking-tight text-white mb-4">
            Popcorn
          </h1>
          <h2 className="text-2xl font-light text-white/70 mb-2">
            Final Phase: Blind Vote
          </h2>
          <p className="text-lg font-light text-white/50">
            Would you watch this movie?
          </p>
        </div>

        {/* Movie Carousel */}
        <div className="w-full max-w-xl mx-auto mb-16 px-12">
          {/* Navigation Arrows */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={previousMovie}
              disabled={currentMovieIndex === 0}
              className="absolute -left-12 z-10 p-2 text-white/70 hover:text-white disabled:opacity-30 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Movie Card */}
            <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl">
              <div className="relative h-full">
                {/* Blurred Movie Image */}
                <div 
                  className="absolute inset-0 blur-3xl"
                  style={{
                    backgroundImage: `url(${movies[currentMovieIndex]?.image_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="absolute inset-0 bg-black/60" />

                {/* Content */}
                <div className="relative h-full flex flex-col p-8">
                  {/* Movie Info - Scrollable Area */}
                  <div className="flex-1 overflow-y-auto mb-8">
                    <p className="text-2xl font-medium text-white mb-2">
                      {movies[currentMovieIndex]?.year}
                    </p>
                    <p className="text-lg font-light text-white/80 leading-relaxed line-clamp-[12]">
                      {movies[currentMovieIndex]?.blind_summary}
                    </p>

                    {/* Ratings */}
                    <div className="space-y-2 mt-4">
                      {movies[currentMovieIndex]?.ratings.map((rating, i) => (
                        <div key={i} className="flex justify-between items-center text-white/70">
                          <span className="font-light truncate mr-4">{rating.source}</span>
                          <span className="font-medium whitespace-nowrap">{rating.score}/{rating.max_score}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vote Buttons - Fixed at Bottom */}
                  <div className="flex gap-4 mt-auto">
                    <button
                      onClick={() => handleVoteChange(movies[currentMovieIndex].movie_id, 'no')}
                      className={`flex-1 py-4 rounded-xl font-medium transition-all duration-300 
                        ${votes[currentMovieIndex]?.vote === 'no' 
                          ? 'bg-red-500 text-white' 
                          : 'bg-white/10 text-white hover:bg-red-500/20'}`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleVoteChange(movies[currentMovieIndex].movie_id, 'yes')}
                      className={`flex-1 py-4 rounded-xl font-medium transition-all duration-300 
                        ${votes[currentMovieIndex]?.vote === 'yes' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-white/10 text-white hover:bg-green-500/20'}`}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={nextMovie}
              disabled={currentMovieIndex === movies.length - 1}
              className="absolute -right-12 z-10 p-2 text-white/70 hover:text-white disabled:opacity-30 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center space-x-2 mt-6">
            {movies.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-200 
                  ${index === currentMovieIndex ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-12 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-light
                   rounded-xl hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Votes'}
        </button>
      </div>
    </main>
  );
}