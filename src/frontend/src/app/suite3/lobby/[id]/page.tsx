'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

interface Participant {
  name: string;
  user_id: string;
  status: string;
}

interface PartyDetails {
  party_id: string;
  status: string;
  current_suite: number;
  participants: Participant[];
}

export default function Suite3LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const isHost = partyDetails?.participants[0]?.user_id === userId;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    
    if (isLoadingMovies) {
      // Start 45 second timeout
      timeoutId = setTimeout(() => {
        setShowTimeout(true);
        setIsLoadingMovies(false);
      }, 45000);
      
      // Update progress bar every second
      progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + (100/45); // Increment to reach 100 in 45 seconds
        });
      }, 1000);
    }

    return () => {
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
    };
  }, [isLoadingMovies]);

  // Fetch party details every 5 seconds
  useEffect(() => {
    const fetchPartyDetails = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
          throw new Error('API base URL is not defined');
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch party details');
        }

        const data = await response.json();
        setPartyDetails(data);
        
        // Check if movies exist in localStorage
        const savedMovies = window.localStorage.getItem(`party_${params.id}_suite3_movies`);
        
        // If status is active and current_suite is 3 and movies exist, redirect
        if (data.status === 'active' && data.current_suite === 3 && savedMovies) {
          router.push(`/suite3/${params.id}?userId=${userId}`);
        }

        setError('');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchPartyDetails();

    // Set up polling
    const pollInterval = setInterval(fetchPartyDetails, 5000);

    // Cleanup
    return () => clearInterval(pollInterval);
  }, [params.id, userId, router]);

  const handleContinue = async () => {
    if (!isHost) return;
    
    setIsLoadingMovies(true);
    setLoadingProgress(0);
    setError('');

    try {
      // First fetch movies
      const moviesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/suite3movies`,
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
      window.localStorage.setItem(`party_${params.id}_suite3_movies`, JSON.stringify(moviesData.movies));

      // Then update party status
      setIsUpdating(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'active',
            current_suite: 3
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update party status');
      }

      // Redirect will happen through the polling effect
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to continue to next suite');
      setIsLoadingMovies(false);
      setIsUpdating(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
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
      <h2 className="text-5xl font-bold text-white text-center mb-12">
        Suite 2 Complete!
      </h2>
      
      {/* Party ID */}
      <div className="text-center mb-12 text-xl font-light italic">
        Party ID: {params.id}
      </div>

      {/* Conditional Content */}
      {isHost ? (
        <div className="w-full max-w-[400px] mb-16">
          <div className="text-2xl mb-16">
            Wait to click continue until all members are complete.
          </div>
          <button
            onClick={handleContinue}
            disabled={isUpdating || isLoadingMovies}
            className="w-full bg-[#4169E1] text-yellow-400 text-xl font-semibold py-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isUpdating ? 'Continuing...' : 'Continue!'}
          </button>
        </div>
      ) : (
        <div className="text-2xl font-light italic">
          Waiting for host to click continue
        </div>
      )}

      {/* Loading Movies Dialog */}
      <AlertDialog open={isLoadingMovies}>
        <AlertDialogContent className="bg-[#1a2231] border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Getting Your Movies Ready</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Please wait while we select the perfect movies for your group...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Progress value={loadingProgress} className="h-2" />
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Timeout Dialog */}
      <AlertDialog open={showTimeout}>
        <AlertDialogContent className="bg-[#1a2231] border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Taking Longer Than Expected</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              We're having trouble loading your movies. Please refresh the page to try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleRefresh} className="bg-[#4169E1] text-white hover:bg-[#4169E1]/90">
              Refresh Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}