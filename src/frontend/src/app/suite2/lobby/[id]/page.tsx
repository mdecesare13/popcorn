'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

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

export default function Suite2LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const isHost = partyDetails?.participants[0]?.user_id === userId;

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
        
        // If status is active and current_suite is 2, redirect to suite2 page
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

  const handleContinue = async () => {
    if (!isHost) return;
    
    setIsUpdating(true);
    setError('');

    try {
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
      setIsUpdating(false);
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
            disabled={isUpdating}
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
    </div>
  );
}