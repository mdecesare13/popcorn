'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui';

export default function JoinPartyEntryPage() {
  const router = useRouter();
  const [partyId, setPartyId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      setError('Please enter a Party ID');
      return;
    }
    router.push(`/join/${partyId}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">ℹ️</span>
          <h3 className="text-2xl font-medium text-white">Enter Party ID</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            placeholder="Enter party ID"
            value={partyId}
            onChange={setPartyId}
            className="bg-white/5 backdrop-blur-sm border-white/10 text-white placeholder:text-white/30"
          />
          
          {error && (
            <p className="text-red-400 text-sm text-center font-light">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 
                     text-white hover:from-blue-700 hover:to-blue-600 transition-all duration-300"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}