'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MovieDetailsDialog from '@/components/ui/MovieDetailsDialog';

// Types
interface Movie {
  movie_id: string;
  title: string;
  year: number;
  image_url: string;
  blind_summary: string;
  ratings: {
    source: string;
    score: string;
    max_score: string;
  }[];
}

interface MovieVotes {
  movie_id: string;
  title: string;
  image_url: string;
  yes_votes: number;
  no_votes: number;
}

const FinalLobbyPage = () => {
  const params = useParams();

  // State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [voteCounts, setVoteCounts] = useState<MovieVotes[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load movies from localStorage
  useEffect(() => {
    const fetchMovies = async () => {
      try {
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
        const movies = partyData.movies_suite3 || [];
        setMovies(movies);
        
        // Initialize vote counts with proper typing
        setVoteCounts(movies.map((movie: Movie) => ({
          movie_id: movie.movie_id,
          title: movie.title,
          image_url: movie.image_url,
          yes_votes: 0,
          no_votes: 0
        })));
      } catch (error) {
        console.error('Error fetching movies:', error);
        setError('Failed to fetch movies');
        setIsLoading(false);
      }
    };

    fetchMovies();
  }, [params.id]);

  // Poll for votes
  useEffect(() => {
    if (!movies.length) return;

    const fetchVotes = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/votes`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch votes');
        }

        const voteData = await response.json();
        
        // Update vote counts
        const newVoteCounts = movies.map(movie => {
          const movieVotes = voteData.vote_counts[movie.movie_id] || {
            yes: 0,
            no: 0,
            seen: 0,
            total: 0
          };
        
          return {
            movie_id: movie.movie_id,
            title: movie.title,
            image_url: movie.image_url,
            yes_votes: parseInt(movieVotes.yes || '0'),
            no_votes: parseInt(movieVotes.no || '0')
          };
        });

        setVoteCounts(newVoteCounts);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching votes:', error);
        setError('Failed to fetch vote results');
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchVotes();

    // Set up polling
    const pollInterval = setInterval(fetchVotes, 5000);

    return () => clearInterval(pollInterval);
  }, [params.id, movies]);

  // Handle bar click
  const handleBarClick = (movieId: string) => {
    const movie = movies.find(m => m.movie_id === movieId);
    if (movie) {
      setSelectedMovie(movie);
      setIsModalOpen(true);
    }
  };

  // Sort vote counts by yes percentage
  const sortedVoteCounts = [...voteCounts].sort((a, b) => {
    const aTotal = a.yes_votes + a.no_votes;
    const bTotal = b.yes_votes + b.no_votes;
    const aPercentage = aTotal > 0 ? (a.yes_votes / aTotal) * 100 : 0;
    const bPercentage = bTotal > 0 ? (b.yes_votes / bTotal) * 100 : 0;
    return bPercentage - aPercentage;
  });

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
            The Results Are In!
          </h2>
          <p className="text-lg font-light text-white/50">
            Click on any movie to see more details
          </p>
        </div>

        {/* Results List */}
        <div className="w-full max-w-5xl mx-auto space-y-4">
          {sortedVoteCounts.map((movie) => {
            const totalVotes = movie.yes_votes + movie.no_votes;
            const yesPercentage = totalVotes > 0 ? (movie.yes_votes / totalVotes) * 100 : 0;
            const noPercentage = totalVotes > 0 ? (movie.no_votes / totalVotes) * 100 : 0;
            
            return (
              <div 
                key={movie.movie_id}
                onClick={() => handleBarClick(movie.movie_id)}
                className="flex items-center gap-6 cursor-pointer px-4 py-3 rounded-xl
                         transition-all duration-300 hover:bg-white/5"
              >
                {/* Movie Poster */}
                <div className="w-24 flex-shrink-0">
                  <div className="aspect-[2/3] relative rounded-lg overflow-hidden">
                    <img 
                      src={movie.image_url} 
                      alt={movie.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Gradient overlays */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                </div>

                {/* Vote Results */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-medium text-white">{movie.title}</h3>
                    <div className="text-sm text-white/50">
                      {totalVotes} votes
                    </div>
                  </div>
                  
                  {/* Vote Stats */}
                  <div className="space-y-2">
                    {/* Vote Labels */}
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-white/70">
                          {movie.yes_votes} Yes
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white/70">
                          {movie.no_votes} No
                        </span>
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                      </div>
                    </div>

                    {/* Combined Progress Bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden relative">
                      {/* Yes Votes (Green) */}
                      <div 
                        className="absolute left-0 h-full bg-green-500 transition-all duration-1000"
                        style={{ width: `${yesPercentage}%` }}
                      />
                      {/* No Votes (Red) */}
                      <div 
                        className="absolute right-0 h-full bg-red-500 transition-all duration-1000"
                        style={{ width: `${noPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Movie Details Modal */}
        <div className="relative z-50">
          <MovieDetailsDialog
            movie={selectedMovie}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            className="max-w-lg w-[calc(100%-2rem)]"
          />
        </div>
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-white">Loading results...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-red-400">{error}</p>
        </div>
      )}
    </main>
  );
};

export default FinalLobbyPage;