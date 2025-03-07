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
  progress?: {
    status: string;
    current_suite: number;
    completed_suites: string[];
    last_updated: string;
  };
}

interface PartyDetails {
  party_id: string;
  status: string;
  current_suite: number;
  participants: Participant[];
}

export default function Suite2LobbyPage() {
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
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
        
        // If status is active and current_suite is 2, redirect
        if (data.status === 'active' && data.current_suite === 2) {
          router.push(`/suite2/${params.id}?userId=${userId}`);
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

  const handleContinue = () => {
    if (!isHost) return;
    
    // Check if any participants haven't completed the previous phase
    const hasIncomplete = partyDetails?.participants.some(p => 
      !p.progress || p.progress.status !== "completed_suite_1"
    );

    if (hasIncomplete) {
      setShowConfirmDialog(true);
    } else {
      handleConfirmContinue();
    }
  };

  const handleConfirmContinue = async () => {
    setShowConfirmDialog(false);
    setIsLoadingMovies(true);
    setLoadingProgress(0);
    setError('');

    try {
      // First fetch movies
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
            current_suite: 2
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

  const getParticipantStatus = (participant: Participant) => {
    if (!participant.progress) {
      return {
        icon: "⏳",
        text: "Not Started",
        color: "text-yellow-400/90",
        bgColor: "bg-yellow-500/10"
      };
    }

    if (participant.progress.status === "completed_suite_1") {
      return {
        icon: "✅",
        text: "Ready",
        color: "text-green-400/90",
        bgColor: "bg-green-500/10"
      };
    }

    return {
      icon: "⏳",
      text: "In Progress",
      color: "text-red-400/90",
      bgColor: "bg-red-500/10"
    };
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
                Waiting for Phase 2
              </h2>
              <div className="text-lg font-light text-white/50">
                Party ID: {params.id}
              </div>
            </div>

            {/* Members List */}
            <div className="mb-16">
              <h2 className="text-2xl font-medium text-white/90 text-center mb-8">
                Participants
              </h2>
              <div className="space-y-4 max-w-lg mx-auto">
                {partyDetails?.participants.map((participant, index) => {
                  const status = getParticipantStatus(participant);
                  return (
                    <div 
                      key={participant.user_id} 
                      className="flex items-center space-x-4 text-xl text-white/80 bg-white/5 backdrop-blur-sm 
                               rounded-xl p-4 transition-all duration-300 hover:bg-white/10"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-medium">
                        {participant.name[0].toUpperCase()}
                      </div>
                      <span className="font-light flex-1">{participant.name}</span>
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${status.bgColor} ${status.color}`}>
                        <span className="text-base">{status.icon}</span>
                        <span className="text-sm font-medium">{status.text}</span>
                      </div>
                      {index === 0 && (
                        <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300/90 text-sm font-medium">
                          Host
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Continue Button (for host) or Waiting Message */}
            {isHost ? (
              <div className="space-y-8 text-center">
                <p className="text-xl font-light text-white/70">
                  Wait for all members to complete Phase 1 before continuing.
                </p>
                <button
                  onClick={handleContinue}
                  disabled={isUpdating || isLoadingMovies}
                  className="px-12 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-light
                           rounded-xl hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
                >
                  {isUpdating ? 'Continuing...' : 'Continue to Phase 2'}
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-2xl font-medium text-white">Are you sure?</h3>
            </div>
            <p className="text-gray-300 mb-8">
              Some participants haven&apos;t completed Phase 1. Continuing now will leave them behind.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleConfirmContinue}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 
                         text-white hover:from-blue-700 hover:to-blue-600 transition-all duration-300"
              >
                Continue Anyway
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Movies Dialog */}
      <AlertDialog open={isLoadingMovies}>
        <AlertDialogContent className="bg-[#151a24]/95 backdrop-blur-sm border-white/10 max-w-lg w-[calc(100%-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-medium text-white">
              Finding Your Perfect Movies
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-light text-white/70">
              Please wait while we analyze everyone&apos;s preferences...
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
              We&apos;re having trouble finding your movies. Please try again.
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