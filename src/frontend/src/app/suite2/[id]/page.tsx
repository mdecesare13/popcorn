'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Slider } from '@/components/ui/slider';
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

export default function Suite2Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  const [movies, setMovies] = useState<Movie[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitProgress, setSubmitProgress] = useState(0);
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);

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
        
        if (partyData.status !== 'active' || partyData.current_suite !== 2) {
          router.push(`/suite2/lobby/${params.id}?userId=${userId}`);
          return;
        }

        // Get movies from localStorage with retry for non-hosts
        const getMoviesWithRetry = async (retries = 3, delay = 2000) => {
          for (let i = 0; i < retries; i++) {
            const savedMovies = window.localStorage.getItem(`party_${params.id}_movies`);
            if (savedMovies) {
              const moviesData = JSON.parse(savedMovies);
              setMovies(moviesData);
              setRatings(moviesData.map(movie => ({
                movie_id: movie.movie_id,
                rating: 5
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
            router.push(`/suite2/lobby/${params.id}?userId=${userId}`);
            return;
          }
        } else {
          // Non-hosts retry a few times
          const success = await getMoviesWithRetry();
          if (!success) {
            router.push(`/suite2/lobby/${params.id}?userId=${userId}`);
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

  // Handle navigation
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

  // Handle touch events for swipe
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentMovieIndex < movies.length - 1) {
      nextMovie();
    }
    if (isRightSwipe && currentMovieIndex > 0) {
      previousMovie();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

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
            Phase 2: Rate Movies
          </h2>
          <p className="text-lg font-light text-white/50">
            Rate each movie from 1 to 10
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

            {/* Carousel Container */}
            <div className="relative w-full overflow-visible">
              {/* Previous Movie Preview - only show if not first movie */}
              {currentMovieIndex > 0 && (
                <div 
                  className="absolute right-[100%] top-0 w-full aspect-[2/3] -mr-32 scale-90 opacity-30 blur-sm transition-all duration-500"
                >
                  <img 
                    src={movies[currentMovieIndex - 1]?.image_url} 
                    alt="Previous movie"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>
              )}

              {/* Next Movie Preview - only show if not last movie */}
              {currentMovieIndex < movies.length - 1 && (
                <div 
                  className="absolute left-[100%] top-0 w-full aspect-[2/3] -ml-32 scale-90 opacity-30 blur-sm transition-all duration-500"
                >
                  <img 
                    src={movies[currentMovieIndex + 1]?.image_url} 
                    alt="Next movie"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>
              )}

              {/* Current Movie Card */}
              <div 
                className="w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl transform-gpu transition-all duration-500"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="relative h-full">
                  <img 
                    src={movies[currentMovieIndex]?.image_url} 
                    alt={movies[currentMovieIndex]?.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                  {/* Movie Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-6 space-y-6">
                    <div>
                      <h3 className="text-2xl font-medium text-white drop-shadow-lg mb-2">
                        {movies[currentMovieIndex]?.title}
                      </h3>
                      <p className="text-lg font-light text-white/70">
                        {movies[currentMovieIndex]?.year}
                      </p>
                    </div>

                    <p className="text-sm font-light text-white/70 line-clamp-3">
                      {movies[currentMovieIndex]?.summary}
                    </p>

                    {/* Rating Control */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-light text-white/70">Rating</span>
                        <span className="text-3xl font-medium text-white">
                          {ratings[currentMovieIndex]?.rating || 5}
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[ratings[currentMovieIndex]?.rating || 5]}
                        onValueChange={([value]) => handleRatingChange(movies[currentMovieIndex].movie_id, value)}
                        className="w-full"
                      />
                    </div>
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
          {isSubmitting ? 'Submitting...' : 'Submit Ratings'}
        </button>
      </div>

      {/* Loading State */}
      {(isLoading || isLoadingMovies) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-white">Loading...</p>
        </div>
      )}

      {/* Submission Progress Overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#151a24]/95 backdrop-blur-sm border-white/10 p-8 rounded-2xl max-w-md w-full">
            <h3 className="text-xl font-medium text-white mb-4">Submitting Ratings...</h3>
            <Progress 
              value={submitProgress} 
              className="mb-4"
              style={{
                '--progress-foreground': 'linear-gradient(to right, rgb(59 130 246), rgb(96 165 250))'
              } as React.CSSProperties}
            />
            <p className="text-sm font-light text-white/50">
              Submitting rating {Math.ceil((submitProgress / 100) * ratings.length)} of {ratings.length}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-red-400">{error}</p>
        </div>
      )}
    </main>
  );
}