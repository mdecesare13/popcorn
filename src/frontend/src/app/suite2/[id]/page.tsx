'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Types
interface Movie {
  movie_id: string;
  title: string;
  year: number;
  image_url: string;
  summary: string;
}

interface Rating {
  movie_id: string;
  rating: number;
}

export default function Suite2Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  const [movies, setMovies] = useState<Movie[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitProgress, setSubmitProgress] = useState(0);
  const [partyDetails, setPartyDetails] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // Fetch party details and movies
  useEffect(() => {
    const fetchData = async () => {
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
        
        if (partyData.status !== 'active' || partyData.current_suite !== 2) {
          throw new Error('Please return to suite 2 lobby or wait for your host to proceed.');
        }

        // Only host fetches movies
        if (isHostUser) {
          const moviesResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/suite2movies`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (!moviesResponse.ok) {
            throw new Error('Failed to fetch movies');
          }

          const moviesData = await moviesResponse.json();
          window.localStorage.setItem(`party_${params.id}_movies`, JSON.stringify(moviesData.movies));
          setMovies(moviesData.movies);
          setRatings(moviesData.movies.map(movie => ({
            movie_id: movie.movie_id,
            rating: 5
          })));
        } else {
          // Non-host users get movies from localStorage
          const savedMovies = window.localStorage.getItem(`party_${params.id}_movies`);
          if (!savedMovies) {
            // If no movies found, wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryMovies = window.localStorage.getItem(`party_${params.id}_movies`);
            if (!retryMovies) {
              throw new Error('No movies found. Please try refreshing the page.');
            }
            const moviesData = JSON.parse(retryMovies);
            setMovies(moviesData);
            setRatings(moviesData.map(movie => ({
              movie_id: movie.movie_id,
              rating: 5
            })));
          } else {
            const moviesData = JSON.parse(savedMovies);
            setMovies(moviesData);
            setRatings(moviesData.map(movie => ({
              movie_id: movie.movie_id,
              rating: 5
            })));
          }
        }
        
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id && userId) fetchData();
  }, [params.id, userId]);

  // Handle rating change
  const handleRatingChange = (movieId: string, newRating: number) => {
    setRatings(prev => 
      prev.map(rating => 
        rating.movie_id === movieId 
          ? { ...rating, rating: newRating } 
          : rating
      )
    );
  };

  // Submit all ratings
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      // Submit each rating
      for (let i = 0; i < ratings.length; i++) {
        const rating = ratings[i];
        setSubmitProgress((i / ratings.length) * 100);
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/rate/${rating.movie_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              rating: rating.rating
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to submit rating ${i + 1}`);
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
              current_suite: 3
            }),
          }
        );

        if (!updateResponse.ok) {
          throw new Error('Failed to update party status');
        }
      }

      // Clear movies from localStorage after successful submission
      window.localStorage.removeItem(`party_${params.id}_movies`);

      // Redirect to suite 3 lobby
      router.push(`/suite3/lobby/${params.id}?userId=${userId}`);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
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
        Phase 2
      </h2>
      <p className="text-xl italic mb-12">Rate the following movies on a scale of 1-10</p>

      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md w-full">
            <h3 className="text-xl mb-4 text-black">Submitting Ratings...</h3>
            <Progress value={submitProgress} className="mb-4" />
            <p className="text-sm text-gray-600">
              Submitting rating {Math.ceil((submitProgress / 100) * ratings.length)} of {ratings.length}
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl space-y-12">
        {movies.map((movie, index) => (
          <div key={movie.movie_id} className="bg-white bg-opacity-10 rounded-lg p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3">
                <img 
                  src={movie.image_url} 
                  alt={movie.title}
                  className="w-full rounded-lg shadow-md"
                />
              </div>
              
              <div className="md:w-2/3">
                <h3 className="text-2xl font-bold mb-2 text-white">{movie.title}</h3>
                <p className="text-gray-400 mb-4">{movie.year}</p>
                <p className="text-gray-300 mb-6">{movie.summary}</p>
                
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-300">
                    Your Rating: {ratings[index]?.rating || 5}
                  </label>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[ratings[index]?.rating || 5]}
                    onValueChange={([value]) => handleRatingChange(movie.movie_id, value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 w-[400px]">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-[#FFD700] text-black text-xl font-semibold py-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Ratings'}
        </button>
      </div>
    </div>
  );
}