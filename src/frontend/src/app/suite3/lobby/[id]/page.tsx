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
      <div className="relative z-10 flex min-h-screen">
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16">
              <h1 className="text-7xl font-medium tracking-tight text-white mb-4">
                Popcorn
              </h1>
              <h2 className="text-2xl font-light text-white/70 mb-2">
                Phase 2 Complete!
              </h2>
              <div className="text-lg font-light text-white/50">
                Party ID: {params.id}
              </div>
            </div>

            {/* Conditional Content */}
            {isHost ? (
              <div className="space-y-8 text-center">
                <p className="text-xl font-light text-white/70">
                  Wait for all members to complete their ratings before continuing.
                </p>
                <button
                  onClick={handleContinue}
                  disabled={isUpdating || isLoadingMovies}
                  className="px-12 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-light
                           rounded-xl hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
                >
                  {isUpdating ? 'Continuing...' : 'Continue to Final Selection'}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xl font-light text-white/50">
                  Waiting for host to continue...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Movies Dialog */}
      <AlertDialog open={isLoadingMovies}>
        <AlertDialogContent className="bg-[#151a24]/95 backdrop-blur-sm border-white/10 max-w-lg w-[calc(100%-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-medium text-white">
              Finding Your Perfect Match
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-light text-white/70">
              Please wait while we analyze everyone&apos;s ratings...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-8">
            <Progress 
              value={loadingProgress} 
              className="h-2 bg-white/10"
              style={{
                '--progress-foreground': 'linear-gradient(to right, rgb(59 130 246), rgb(96 165 250))'
              } as React.CSSProperties}
            />
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Timeout Dialog */}
      <AlertDialog open={showTimeout}>
        <AlertDialogContent className="bg-[#151a24]/95 backdrop-blur-sm border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-medium text-white">
              Taking Longer Than Expected
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-light text-white/70">
              We&apos;re having trouble finding your final movie. Please try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={handleRefresh}
              className="px-8 py-3 bg-white/10 backdrop-blur-sm text-white text-base font-light
                       rounded-lg hover:bg-white/20 transition-all duration-300"
            >
              Refresh Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-white">Loading...</p>
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