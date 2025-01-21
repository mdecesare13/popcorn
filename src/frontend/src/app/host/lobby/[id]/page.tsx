'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Participant {
  name: string;
  user_id: string;
  status: string;
}

interface PartyDetails {
  party_id: string;
  status: string;
  participants: Participant[];
}

export default function HostLobbyPage() {
  const params = useParams();
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch party details every 2 seconds
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
    const pollInterval = setInterval(fetchPartyDetails, 2000);

    // Cleanup
    return () => clearInterval(pollInterval);
  }, [params.id]);

  const handleStart = async () => {
    // TODO: Implement start functionality
    console.log('Start clicked');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#151a24] text-white">
        <div className="text-lg">Loading lobby...</div>
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
        Lobby
      </h2>
      
      {/* Party ID */}
      <div className="text-center mb-12 text-xl font-light italic">
        Party ID: {params.id}
      </div>

      {/* Members Section */}
      <div className="w-full max-w-[400px] mb-16">
        <h3 className="text-3xl font-bold mb-6">Members</h3>
        <div className="space-y-4">
          {partyDetails?.participants.map((participant, index) => (
            <div key={participant.user_id} className="text-2xl font-light">
              {participant.name} {index === 0 ? '(host)' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <div className="w-[400px]">
        <button
          onClick={handleStart}
          className="w-full bg-[#4169E1] text-white text-xl font-semibold py-4 rounded-lg hover:opacity-90 transition-opacity"
        >
          Start!
        </button>
      </div>
    </div>
  );
}