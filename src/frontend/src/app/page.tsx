'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function Home() {
  const router = useRouter();

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
          <div className="w-full max-w-md text-center">
            {/* Logo/Title */}
            <h1 className="text-8xl font-medium tracking-tight text-white mb-4">
              Popcorn
            </h1>
            <p className="text-xl font-light text-white/70 mb-16">
              Watch movies together, wherever you are
            </p>

            {/* Buttons */}
            <div className="space-y-4">
              <Button 
                className="w-full bg-white/10 backdrop-blur-sm text-white text-lg font-light py-6 
                         rounded-xl hover:bg-white/20 transition-all duration-300"
                onClick={() => router.push('/host')}
              >
                Host a Movie Night
              </Button>
              
              <Button 
                className="w-full bg-white/5 backdrop-blur-sm text-white/90 text-lg font-light py-6 
                         rounded-xl hover:bg-white/10 transition-all duration-300"
                onClick={() => router.push('/join')}
              >
                Join a Party
              </Button>
            </div>

            {/* Optional: Add a subtle footer */}
            <p className="mt-16 text-sm font-light text-white/40">
              Get ready for the perfect movie night
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}