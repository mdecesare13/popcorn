'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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

interface PartyDetails {
  party_id: string;
  status: string;
  current_suite: number;
  participants: {
    user_id: string;
    name: string;
    status: string;
  }[];
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
  const [submitProgress, setSubmitProgress] = useState(0);
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [missingVotes, setMissingVotes] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

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
        setPartyDetails(partyData);
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
              setVotes(moviesData.map(movie => ({
                movie_id: movie.movie_id,
                vote: null
              })));
              setIsLoadingMovies(false);
              return true;
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
    // Clear movie from missing votes when it gets a vote
    setMissingVotes(prev => prev.filter(id => id !== movieId));
  };

  // Submit all votes
  const handleSubmit = async () => {
    // Check for missing votes and highlight them
    const missing = votes
      .filter(vote => vote.vote === null)
      .map(vote => vote.movie_id);
    
    if (missing.length > 0) {
      setMissingVotes(missing);
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
        setSubmitProgress((i / votes.length) * 100);
        
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

      // Redirect to final lobby
      router.push(`/final/lobby/${params.id}?userId=${userId}`);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setIsSubmitting(false);
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
    <div className="min-h-screen flex flex-col items-center p-8 bg-[#151a24] text-white">
      {/* Header */}
      <h1 className="text-4xl font-bold text-[#FFD700] text-center mb-2">
        Popcorn
      </h1>
      <h2 className="text-5xl font-bold text-white text-center mb-4">
        Suite 3
      </h2>
      <p className="text-xl italic mb-12">Time for your blind vote! Vote yes or no on the below movies?</p>

      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md w-full">
            <h3 className="text-xl mb-4 text-black">Submitting Votes...</h3>
            <Progress value={submitProgress} className="mb-4" />
            <p className="text-sm text-gray-600">
              Submitting vote {Math.ceil((submitProgress / 100) * votes.length)} of {votes.length}
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl space-y-12">
        {movies.map((movie, index) => {
          const needsVote = missingVotes.includes(movie.movie_id);
          return (
            <div 
              key={movie.movie_id}
              id={`movie-${movie.movie_id}`}
              className={`bg-white bg-opacity-10 rounded-lg p-6 transition-all ${
                needsVote ? 'ring-2 ring-red-500 ring-opacity-70 shadow-lg shadow-red-500/20' : ''
              }`}
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/3">
                  <div 
                    className="w-full rounded-lg shadow-md overflow-hidden relative aspect-[2/3]"
                    style={{
                      background: `url(${movie.image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(30px)'
                    }}
                  />
                </div>
                
                <div className="md:w-2/3">
                  <p className="text-gray-400 mb-4">{movie.year}</p>
                  <p className="text-gray-300 mb-6">{movie.blind_summary}</p>
                  
                  <div className="space-y-4">
                    {/* Ratings */}
                    <div className="space-y-2">
                      {movie.ratings.map((rating, i) => (
                        <div key={i} className="text-sm text-gray-300">
                          {rating.source}: {rating.score}/{rating.max_score}
                        </div>
                      ))}
                    </div>

                    {/* Vote Radio Buttons */}
                    <div className={needsVote ? 'animate-pulse' : ''}>
                      <RadioGroup 
                        value={votes[index]?.vote || ''}
                        onValueChange={(value: 'yes' | 'no') => handleVoteChange(movie.movie_id, value)}
                        className="flex gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem 
                            value="yes" 
                            id={`yes-${movie.movie_id}`}
                            className="transition-transform duration-200 data-[state=checked]:scale-150 data-[state=checked]:bg-green-500"
                          />
                          <Label 
                            htmlFor={`yes-${movie.movie_id}`}
                            className="text-white"
                          >
                            Yes
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem 
                            value="no" 
                            id={`no-${movie.movie_id}`}
                            className="transition-transform duration-200 data-[state=checked]:scale-150 data-[state=checked]:bg-red-500"
                          />
                          <Label 
                            htmlFor={`no-${movie.movie_id}`}
                            className="text-white"
                          >
                            No
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 w-[400px]">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-[#FFD700] text-black text-xl font-semibold py-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Votes'}
        </button>
      </div>
    </div>
  );
}