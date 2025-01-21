'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPartyPage() {
  const router = useRouter();
  const [partyId, setPartyId] = useState('');
  const [userName, setUserName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !userName) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      console.log('Attempting to join party with:', {
        partyId,
        userName,
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${partyId}/join`
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${partyId}/join`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_name: userName }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Join party error details:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to join party: ${errorText}`);
      }

      const data = await response.json();
      console.log('Successfully joined party:', data);
      router.push(`/join/lobby/${partyId}?userId=${data.user_id}`);
    } catch (error) {
      console.error('Error joining party:', error);
      setError(error instanceof Error ? error.message : 'Failed to join party. Please check the Party ID and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 bg-[#151a24] text-white">
      {/* Header */}
      <h1 className="text-4xl font-bold text-[#FFD700] text-center mb-2">
        Popcorn
      </h1>
      <h2 className="text-5xl font-bold text-white text-center mb-12">
        Join Party
      </h2>

      {/* Form */}
      <div className="w-[400px]">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="partyId" className="text-2xl font-bold block mb-2">
              Party ID
            </label>
            <input
              id="partyId"
              type="text"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              placeholder="Enter party ID"
              className="w-full p-4 rounded-lg bg-white text-black text-xl"
            />
          </div>

          <div>
            <label htmlFor="userName" className="text-2xl font-bold block mb-2">
              User Name
            </label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-4 rounded-lg bg-white text-black text-xl"
            />
          </div>

          {error && (
            <div className="text-red-500 text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#4169E1] text-white text-xl font-semibold py-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Join Party
          </button>
        </form>
      </div>
    </div>
  );
}