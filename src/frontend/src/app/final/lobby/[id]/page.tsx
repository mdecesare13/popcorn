'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import BarChart from '@/components/ui/BarChart';
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
  yes_votes: number;
  no_votes: number;
}

interface VoteResponse {
  movie_id: string;
  vote_counts: {
    yes: string;
    no: string;
    total: string;
  };
}

const FinalLobbyPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');

  // State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [voteCounts, setVoteCounts] = useState<MovieVotes[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load movies from localStorage
  useEffect(() => {
    const savedMovies = window.localStorage.getItem(`party_${params.id}_final_movies`);
    if (savedMovies) {
      const movieData = JSON.parse(savedMovies);
      setMovies(movieData);
      
      // Initialize vote counts with 0s
      setVoteCounts(movieData.map(movie => ({
        movie_id: movie.movie_id,
        title: movie.title,
        yes_votes: 0,
        no_votes: 0
      })));
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#151a24] text-white">
        <div className="text-lg">Loading results...</div>
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
    <div className="min-h-screen bg-[#151a24] text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-4xl font-bold text-[#FFD700] text-center mb-2">
          Popcorn
        </h1>
        <h2 className="text-5xl font-bold text-white text-center mb-12">
          Final Results
        </h2>

        <div className="flex gap-12">
          {/* Left side - Selected movie */}
          <div className="w-1/3">
            <div className="sticky top-8">
              {selectedMovie ? (
                <div>
                  <img 
                    src={selectedMovie.image_url}
                    alt={selectedMovie.title}
                    className="w-full rounded-lg shadow-xl mb-4"
                  />
                  <h3 className="text-2xl font-bold mb-2">{selectedMovie.title}</h3>
                  <p className="text-gray-400 mb-4">{selectedMovie.year}</p>
                  <p className="text-gray-300">{selectedMovie.blind_summary}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-white/5 rounded-lg">
                  <p className="text-gray-400">Click a movie to see details</p>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Bar chart */}
          <div className="w-2/3">
            <BarChart 
              data={voteCounts}
              onBarClick={handleBarClick}
            />
          </div>
        </div>

        {/* Modal */}
        <MovieDetailsDialog
          movie={selectedMovie}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default FinalLobbyPage;