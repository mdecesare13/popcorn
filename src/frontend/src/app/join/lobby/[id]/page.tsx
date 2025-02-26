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
  participants: Participant[];
}

export default function MemberLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

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
        
        // If status has changed to active, redirect to suite 1
        if (data.status === 'active') {
          router.push(`/suite1/${params.id}?userId=${userId}`);
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

    // Set up polling with 5-second interval
    const pollInterval = setInterval(fetchPartyDetails, 5000);

    // Cleanup
    return () => clearInterval(pollInterval);
  }, [params.id, userId, router]);

  const handleInvite = () => {
    const message = `Join my Popcorn lobby and let's watch a movie!\nParty ID: ${params.id}\nhttp://localhost:3000/join`;
    
    // Try using Web Share API first (works well on mobile)
    if (navigator.share) {
      navigator.share({
        title: 'Join my Popcorn lobby',
        text: message
      }).catch(err => {
        // Fallback to SMS URL scheme
        window.open(`sms:?&body=${encodeURIComponent(message)}`);
      });
    } else {
      // Fallback to SMS URL scheme for browsers without Web Share API
      window.open(`sms:?&body=${encodeURIComponent(message)}`);
    }
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
      <div className="text-center mb-2 text-xl font-light italic">
        Party ID: {params.id}
      </div>
      
      {/* Invite Button */}
      <div className="text-center mb-10">
        <button 
          onClick={handleInvite}
          className="flex items-center justify-center space-x-2 bg-green-500 text-black font-medium py-2 px-4 rounded-lg hover:bg-green-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
            <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
          </svg>
          <span>Send Invite</span>
        </button>
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

      {/* Waiting Message */}
      <div className="text-xl font-light italic">
        Waiting for host to start
      </div>
    </div>
  );
}