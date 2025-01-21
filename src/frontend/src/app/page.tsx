'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-4xl font-bold text-center text-yellow-400 mb-8">
          Popcorn
        </h1>
        
        <div className="space-y-4">
          <Button 
            fullWidth 
            onClick={() => router.push('/host')}
          >
            Host a Movie Night
          </Button>
          
          <Button 
            fullWidth 
            variant="secondary" 
            onClick={() => router.push('/join')}
          >
            Join a Party
          </Button>
        </div>
      </div>
    </main>
  );
}