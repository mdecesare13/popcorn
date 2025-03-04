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
  const [copyFeedback, setCopyFeedback] = useState(false);

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
    if (navigator.share) {
      navigator.share({
        title: 'Join my Popcorn lobby',
        text: "Let's pick a movie!",
        url: `https://popcorn-sand.vercel.app/join/${params.id}`
      }).catch(() => {
        const message = `Join my Popcorn lobby and let's pick a movie!\nhttps://popcorn-sand.vercel.app/join/${params.id}`;
        window.open(`sms:?&body=${encodeURIComponent(message)}`);
      });
    } else {
      const message = `Join my Popcorn lobby and let's pick a movie!\nhttps://popcorn-sand.vercel.app/join/${params.id}`;
      window.open(`sms:?&body=${encodeURIComponent(message)}`);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(params.id as string);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = params.id as string;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
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
      <div className="relative z-10 flex h-screen">
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16">
              <h1 className="text-7xl font-medium tracking-tight text-white mb-4">
                Popcorn
              </h1>
              <div className="flex flex-col md:flex-row items-center justify-center md:space-x-6 space-y-4 md:space-y-0 text-gray-300">
                <button
                  onClick={handleCopyId}
                  className="flex items-center space-x-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-lg
                           hover:bg-white/10 transition-all duration-300"
                >
                  {copyFeedback ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" />
                      <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375z" />
                    </svg>
                  )}
                  <span className="font-light">{copyFeedback ? 'Copy Party ID' : 'Copy Party ID'}</span>
                </button>
                <button 
                  onClick={handleInvite}
                  className="flex items-center space-x-2 bg-white/5 backdrop-blur-sm px-6 py-2 rounded-lg
                           hover:bg-white/10 transition-all duration-300 justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                    <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                  </svg>
                  <span className="font-light">Invite Friends</span>
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="mb-16">
              <h2 className="text-2xl font-medium text-white/90 text-center mb-8">Waiting Room</h2>
              <div className="space-y-4 max-w-lg mx-auto">
                {partyDetails?.participants.map((participant, index) => (
                  <div 
                    key={participant.user_id} 
                    className="flex items-center space-x-4 text-xl text-white/80 bg-white/5 backdrop-blur-sm 
                             rounded-xl p-4 transition-all duration-300 hover:bg-white/10"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-medium">
                      {participant.name[0].toUpperCase()}
                    </div>
                    <span className="font-light">{participant.name}</span>
                    {index === 0 && (
                      <span className="ml-auto px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300/90 text-sm font-medium">
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Waiting Message */}
            <div className="text-center">
              <p className="text-xl font-light text-white/50">
                Waiting for host to start the party...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-white">Loading lobby...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-red-400">{error}</p>
        </div>
      )}
    </main>
  );
}