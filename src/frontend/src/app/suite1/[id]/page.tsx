'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Checkbox } from "@/components/ui/checkbox";

const GENRES = [
  "Documentary", "Fantasy", "Adventure", "War", "Animation",
  "Comedy", "Music", "Thriller", "Crime", "History",
  "Mystery", "TV Movie", "Drama", "Horror", "Western",
  "Romance", "Family", "Science Fiction", "Action"
];

const DECADES = ["1960", "1970", "1980", "1990", "2000", "2010", "2020"];

export default function Suite1Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partyDetails, setPartyDetails] = useState(null);

  // Form state
  const [genrePreferences, setGenrePreferences] = useState([]);
  const [genreDealbreakers, setGenreDealbreakers] = useState([]);
  const [decadePreferences, setDecadePreferences] = useState([]);
  const [yearCutoff, setYearCutoff] = useState('');

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

  const handleGenrePreferenceChange = (genre) => {
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

  const handleGenreDealbreakersChange = (genre) => {
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

  const handleDecadePreferenceChange = (decade) => {
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
      <h2 className="text-5xl font-bold text-white text-center mb-4">
        Phase 1
      </h2>
      <p className="text-xl italic mb-12">Tell us your do's and don'ts</p>

      {/* Genre Preferences */}
      <div className="w-full max-w-[600px] mb-8">
        <h3 className="text-2xl font-bold mb-4">What genres do you prefer? <span className="text-lg font-normal italic">Choose 2</span></h3>
        <div className="grid grid-cols-2 gap-4">
          {GENRES.map((genre) => (
            <div key={`pref-${genre}`} className="flex items-center space-x-2">
              <Checkbox
                id={`pref-${genre}`}
                checked={genrePreferences.includes(genre)}
                onChange={() => handleGenrePreferenceChange(genre)}
                disabled={
                  (genrePreferences.length >= 2 && !genrePreferences.includes(genre)) ||
                  genreDealbreakers.includes(genre)
                }
              />
              <label htmlFor={`pref-${genre}`} className="text-lg">
                {genre}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Genre Dealbreakers */}
      <div className="w-full max-w-[600px] mb-8">
        <h3 className="text-2xl font-bold mb-4">What genres are absolute no-go's? <span className="text-lg font-normal italic">Choose 1</span></h3>
        <div className="grid grid-cols-2 gap-4">
          {GENRES.map((genre) => (
            <div key={`deal-${genre}`} className="flex items-center space-x-2">
              <Checkbox
                id={`deal-${genre}`}
                checked={genreDealbreakers.includes(genre)}
                onChange={() => handleGenreDealbreakersChange(genre)}
                disabled={
                  (genreDealbreakers.length >= 1 && !genreDealbreakers.includes(genre)) ||
                  genrePreferences.includes(genre)
                }
              />
              <label htmlFor={`deal-${genre}`} className="text-lg">
                {genre}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Decade Preferences */}
      <div className="w-full max-w-[600px] mb-8">
        <h3 className="text-2xl font-bold mb-4">Any decades you prefer? <span className="text-lg font-normal italic">Choose 2</span></h3>
        <div className="grid grid-cols-4 gap-4">
          {DECADES.map((decade) => (
            <div key={`decade-${decade}`} className="flex items-center space-x-2">
              <Checkbox
                id={`decade-${decade}`}
                checked={decadePreferences.includes(decade)}
                onChange={() => handleDecadePreferenceChange(decade)}
                disabled={decadePreferences.length >= 2 && !decadePreferences.includes(decade)}
              />
              <label htmlFor={`decade-${decade}`} className="text-lg">
                {decade}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Year Cutoff */}
      <div className="w-full max-w-[600px] mb-12">
        <h3 className="text-2xl font-bold mb-4">What year would you refuse to watch a movie before?</h3>
        <select
          className="w-full p-3 bg-white text-black rounded"
          value={yearCutoff}
          onChange={(e) => setYearCutoff(e.target.value)}
        >
          <option value="">Select a year...</option>
          {DECADES.map(decade => (
            <option key={decade} value={decade}>{decade}</option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <div className="w-[400px]">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-[#FFD700] text-black text-xl font-semibold py-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}