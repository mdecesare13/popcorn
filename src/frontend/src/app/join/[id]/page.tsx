'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Input, Button } from '@/components/ui';

export default function JoinPartyPage() {
  const router = useRouter();
  const params = useParams();
  const [userName, setUserName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName) {
      setError('Please enter your name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/join`,
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
        throw new Error(`Failed to join party: ${errorText}`);
      }

      const data = await response.json();
      router.push(`/join/lobby/${params.id}?userId=${data.user_id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to join party');
    } finally {
      setIsSubmitting(false);
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
      <div className="relative z-10 flex min-h-screen">
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-16">
              <h1 className="text-7xl font-medium tracking-tight text-white mb-4">
                Popcorn
              </h1>
              <h2 className="text-2xl font-light text-white/70">
                Join Party: {params.id}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12">
              {/* User Name Input */}
              <Input
                label="Your Name"
                placeholder="Enter your name"
                value={userName}
                onChange={setUserName}
                className="bg-white/5 backdrop-blur-sm border-white/10 text-white placeholder:text-white/30"
                labelClass="text-white/70 font-light"
                disabled={isSubmitting}
              />

              {error && (
                <p className="text-red-400 text-sm text-center font-light">
                  {error}
                </p>
              )}

              {/* Submit Button */}
              <Button 
                type="submit"
                className="w-full bg-white/10 backdrop-blur-sm text-white text-lg font-light py-6 
                         rounded-xl hover:bg-white/20 transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Joining...' : 'Join Party'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
} 