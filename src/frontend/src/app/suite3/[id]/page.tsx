'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import SwipeableCard from '@/components/ui/SwipeableCard';

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

export default function Suite3Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Current movie index for the stack
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);
  const [isVoting, setIsVoting] = useState(false);

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
            try {
              const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                const partyData = await response.json();
                if (partyData.movies_suite3) {
                  setMovies(partyData.movies_suite3);
                  setIsLoadingMovies(false);
                  return true;
                }
              }
            } catch (error) {
              console.error('Failed to fetch party details:', error);
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

  // Handle vote submission for a single movie
  const handleVote = async (movieId: string, vote: 'yes' | 'no') => {
    if (isVoting) return;
    
    setIsVoting(true);
    
    try {
      // Submit vote to API
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
            movie_id: movieId,
            vote
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit vote');
      }
      
      // Move to next movie
      if (currentMovieIndex < movies.length - 1) {
        setCurrentMovieIndex(prev => prev + 1);
      } else {
        // All votes completed
        await completeVoting();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  // Complete the voting process and redirect
  const completeVoting = async () => {
    try {
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

      // Update user progress
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
            Swipe right for movies you&apos;d watch, left for those you wouldn&apos;t
          </p>
        </div>

        {/* Movie Card Stack */}
        <div className="w-full max-w-xl mx-auto mb-16 px-4 h-[70vh]">
          <div className="relative w-full h-full">
            {/* Stack of cards - render current and next card */}
            {movies.map((movie, index) => {
              // Only render current card and next card for performance
              if (index < currentMovieIndex || index > currentMovieIndex + 1) return null;
              
              return (
                <SwipeableCard
                  key={movie.movie_id}
                  movie={movie}
                  onVote={handleVote}
                  isActive={index === currentMovieIndex}
                />
              );
            })}
            
            {/* Show loading spinner when all cards are swiped */}
            {currentMovieIndex >= movies.length && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-white border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                      Loading...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center space-x-2 mt-6">
            {movies.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-200 
                  ${index === currentMovieIndex ? 'bg-white' : 
                    index < currentMovieIndex ? 'bg-white/70' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}