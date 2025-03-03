'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Checkbox } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GENRES = [
  "Action","Drama","Comedy","Thriller","Adventure",
  "Fantasy","Family","Science Fiction","Horror"
];

const DECADES = ["1970", "1980", "1990", "2000", "2010", "2020"];

// Add interface for party details
interface PartyDetails {
  party_id: string;
  status: string;
  participants: {
    user_id: string;
    name: string;
    status: string;
  }[];
}

export default function Suite1Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  // Fix state types
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [genrePreferences, setGenrePreferences] = useState<string[]>([]);
  const [genreDealbreakers, setGenreDealbreakers] = useState<string[]>([]);
  const [decadePreferences, setDecadePreferences] = useState<string[]>([]);
  const [yearCutoff, setYearCutoff] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch party details to determine if user is host
  useEffect(() => {
    const fetchPartyDetails = async () => {
      try {
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

    fetchPartyDetails();
  }, [params.id]);

  const isHost = userId === partyDetails?.participants[0]?.user_id;

  // Fix handler types
  const handleGenrePreferenceChange = (genre: string) => {
    setGenrePreferences(prev => {
      if (prev.includes(genre)) {
        return prev.filter(g => g !== genre);
      }
      if (prev.length >= 2) return prev;
      // Remove from dealbreakers if it was there
      setGenreDealbreakers(current => current.filter(g => g !== genre));
      return [...prev, genre];
    });
  };

  const handleGenreDealbreakersChange = (genre: string) => {
    setGenreDealbreakers(prev => {
      if (prev.includes(genre)) {
        return prev.filter(g => g !== genre);
      }
      if (prev.length >= 1) return prev;
      // Remove from preferences if it was there
      setGenrePreferences(current => current.filter(g => g !== genre));
      return [...prev, genre];
    });
  };

  const handleDecadePreferenceChange = (decade: string) => {
    setDecadePreferences(prev => {
      if (prev.includes(decade)) {
        return prev.filter(d => d !== decade);
      }
      if (prev.length >= 2) return prev;
      return [...prev, decade];
    });
  };

  const handleSubmit = async () => {
    if (
      genrePreferences.length !== 2 ||
      genreDealbreakers.length !== 1 ||
      decadePreferences.length !== 2 ||
      !yearCutoff
    ) {
      setError('Please complete all selections');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Log the submission data
      console.log('Submitting preferences:', {
        user_id: userId,
        preferences: {
          genre_preferences: genrePreferences,
          genre_dealbreakers: genreDealbreakers,
          decade_preferences: decadePreferences,
          year_cutoff: parseInt(yearCutoff)
        }
      });
      // Submit preferences
      const preferenceResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/preferences`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
                      body: JSON.stringify({
            user_id: userId,
            genre_preferences: genrePreferences || [],
            genre_dealbreakers: genreDealbreakers || [],
            decade_preferences: decadePreferences || [],
            year_cutoff: yearCutoff ? parseInt(yearCutoff) : null
          }),
        }
      );

      if (!preferenceResponse.ok) {
        throw new Error('Failed to submit preferences');
      }

      // If user is host, update party status
      if (isHost) {
        const updateResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'lobby',
              current_suite: 2
            }),
          }
        );

        if (!updateResponse.ok) {
          throw new Error('Failed to update party status');
        }
      }

      // Redirect to Suite 2 lobby
      router.push(`/suite2/lobby/${params.id}?userId=${userId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
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
      <div className="relative z-10 min-h-screen overflow-auto py-12 px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-7xl font-medium tracking-tight text-white mb-4">
              Popcorn
            </h1>
            <h2 className="text-2xl font-light text-white/70 mb-2">
              Phase 1: Preferences
            </h2>
            <p className="text-lg font-light text-white/50">
              Tell us what you love (and hate) in movies
            </p>
          </div>

          <div className="space-y-16">
            {/* Genre Preferences */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
              <h3 className="text-xl font-medium text-white/90 mb-6">
                Favorite Genres <span className="text-white/50 font-light">(Choose 2)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {GENRES.map((genre) => (
                  <div 
                    key={`pref-${genre}`} 
                    className={`flex items-center space-x-3 p-3 rounded-xl transition-colors
                      ${genrePreferences.includes(genre) ? 'bg-white/10' : 'hover:bg-white/5'}
                      ${(genrePreferences.length >= 2 && !genrePreferences.includes(genre)) || 
                        genreDealbreakers.includes(genre) ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      id={`pref-${genre}`}
                      checked={genrePreferences.includes(genre)}
                      onChange={() => handleGenrePreferenceChange(genre)}
                      disabled={(genrePreferences.length >= 2 && !genrePreferences.includes(genre)) ||
                               genreDealbreakers.includes(genre)}
                      className="bg-white/10"
                      labelClass="text-white/90 font-light"
                      label={genre}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Genre Dealbreakers */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
              <h3 className="text-xl font-medium text-white/90 mb-6">
                Deal Breakers <span className="text-white/50 font-light">(Choose 1)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {GENRES.map((genre) => (
                  <div 
                    key={`deal-${genre}`} 
                    className={`flex items-center space-x-3 p-3 rounded-xl transition-colors
                      ${genreDealbreakers.includes(genre) ? 'bg-red-500/10' : 'hover:bg-white/5'}
                      ${(genreDealbreakers.length >= 1 && !genreDealbreakers.includes(genre)) || 
                        genrePreferences.includes(genre) ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      id={`deal-${genre}`}
                      checked={genreDealbreakers.includes(genre)}
                      onChange={() => handleGenreDealbreakersChange(genre)}
                      disabled={(genreDealbreakers.length >= 1 && !genreDealbreakers.includes(genre)) ||
                               genrePreferences.includes(genre)}
                      className="bg-white/10"
                      labelClass="text-white/90 font-light"
                      label={genre}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Decade Preferences */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
              <h3 className="text-xl font-medium text-white/90 mb-6">
                Preferred Decades <span className="text-white/50 font-light">(Choose 2)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {DECADES.map((decade) => (
                  <div 
                    key={`decade-${decade}`} 
                    className={`flex items-center space-x-3 p-3 rounded-xl transition-colors
                      ${decadePreferences.includes(decade) ? 'bg-white/10' : 'hover:bg-white/5'}
                      ${decadePreferences.length >= 2 && !decadePreferences.includes(decade) ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      id={`decade-${decade}`}
                      checked={decadePreferences.includes(decade)}
                      onChange={() => handleDecadePreferenceChange(decade)}
                      disabled={decadePreferences.length >= 2 && !decadePreferences.includes(decade)}
                      className="bg-white/10"
                      labelClass="text-white/90 font-light"
                      label={decade}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Year Cutoff */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
              <h3 className="text-xl font-medium text-white/90 mb-6">
                Oldest Movie You&apos;d Watch
              </h3>
              <div className="relative">
                <Select value={yearCutoff} onValueChange={setYearCutoff}>
                  <SelectTrigger className="w-full bg-white/10 text-white border-none">
                    <SelectValue placeholder="Select a year..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2c] border-white/10 text-white">
                    {DECADES.map(decade => (
                      <SelectItem 
                        key={decade} 
                        value={decade}
                        className="hover:bg-white/5 focus:bg-white/5 focus:text-white"
                      >
                        {decade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>

          {/* Error Message */}
          {error && (
            <p className="mt-8 text-red-400 text-center font-light">
              {error}
            </p>
          )}

          {/* Submit Button */}
          <div className="mt-12 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-12 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-light
                       rounded-xl hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-white">Loading...</p>
        </div>
      )}
    </main>
  );
}