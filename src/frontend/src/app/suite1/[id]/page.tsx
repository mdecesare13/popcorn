'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Genre data with icons
const GENRES = [
  { id: "Action", icon: "🔥" },
  { id: "Drama", icon: "🎭" },
  { id: "Comedy", icon: "😂" },
  { id: "Thriller", icon: "🔍" },
  { id: "Adventure", icon: "🌍" },
  { id: "Fantasy", icon: "✨" },
  { id: "Family", icon: "👨‍👩‍👧‍👦" },
  { id: "Science Fiction", icon: "🚀" },
  { id: "Horror", icon: "👻" }
];

// Decade data with context
const DECADES = [
  { id: "1970", icon: "🕰️" },
  { id: "1980", icon: "📼" },
  { id: "1990", icon: "💿" },
  { id: "2000", icon: "💻" },
  { id: "2010", icon: "📱" },
  { id: "2020", icon: "🎬" }
];

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

// Define interfaces for our data types
interface GenreItem {
  id: string;
  icon: string;
}

interface DecadeItem {
  id: string;
  icon: string;
}

export default function Suite1Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  // Party and loading states
  const [partyDetails, setPartyDetails] = useState<PartyDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Selection states
  const [favoriteGenre1, setFavoriteGenre1] = useState<string | null>(null);
  const [favoriteGenre2, setFavoriteGenre2] = useState<string | null>(null);
  const [dealBreakerGenre, setDealBreakerGenre] = useState<string | null>(null);
  const [favoriteDecade1, setFavoriteDecade1] = useState<string | null>(null);
  const [favoriteDecade2, setFavoriteDecade2] = useState<string | null>(null);
  const [yearCutoff, setYearCutoff] = useState<string | null>(null);

  // Track current question
  const [currentStep, setCurrentStep] = useState(1);

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

        if (data.status === 'active' && data.current_suite === 1) {
          // Update user progress to show they've started Suite 1
          await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userId,
                progress: {
                  status: 'in_suite_1',
                  current_suite: 1,
                  last_updated: new Date().toISOString()
                }
              })
            }
          );
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartyDetails();
  }, [params.id, userId]);

  const isHost = userId === partyDetails?.participants[0]?.user_id;

  // Handle selection and advance to next question
  const handleGenreSelect = (genre: string, questionNumber: number) => {
    if (questionNumber === 1) {
      setFavoriteGenre1(genre);
      setCurrentStep(2);
    } else if (questionNumber === 2) {
      setFavoriteGenre2(genre);
      setCurrentStep(3);
    } else if (questionNumber === 3) {
      setDealBreakerGenre(genre);
      setCurrentStep(4);
    }
  };

  const handleDecadeSelect = (decade: string, questionNumber: number) => {
    if (questionNumber === 4) {
      setFavoriteDecade1(decade);
      setCurrentStep(5);
    } else if (questionNumber === 5) {
      setFavoriteDecade2(decade);
      setCurrentStep(6);
    }
  };

  const handleYearCutoffSelect = (year: string) => {
    setYearCutoff(year);
    setCurrentStep(7); // Advance to step 7 to minimize the last question
    
    // Short delay to allow the animation to complete before showing loading
    setTimeout(() => {
      if (
        favoriteGenre1 &&
        favoriteGenre2 &&
        dealBreakerGenre &&
        favoriteDecade1 &&
        favoriteDecade2 &&
        year
      ) {
        setIsSubmitting(true);
        submitPreferences(year);
      }
    }, 600); // Wait for the animation to complete
  };

  // Create a separate function for submitting preferences
  const submitPreferences = async (yearCutoffValue: string) => {
    try {
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
            genre_preferences: [favoriteGenre1, favoriteGenre2],
            genre_dealbreakers: [dealBreakerGenre],
            decade_preferences: [favoriteDecade1, favoriteDecade2],
            year_cutoff: parseInt(yearCutoffValue)
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

      // Update user progress to completed Suite 1
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/party/${params.id}/update`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            progress: {
              status: 'completed_suite_1',
              current_suite: 1,
              completed_suites: ['suite_1'],
              last_updated: new Date().toISOString()
            }
          })
        }
      );

      // Redirect to Suite 2 lobby
      router.push(`/suite2/lobby/${params.id}?userId=${userId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  // Filter available options based on previous selections
  const getAvailableGenres = (questionNumber: number) => {
    if (questionNumber === 1) {
      return GENRES;
    } else if (questionNumber === 2) {
      return GENRES.filter(genre => genre.id !== favoriteGenre1);
    } else if (questionNumber === 3) {
      return GENRES.filter(genre => 
        genre.id !== favoriteGenre1 && genre.id !== favoriteGenre2
      );
    }
    return [];
  };

  const getAvailableDecades = (questionNumber: number) => {
    if (questionNumber === 4) {
      return DECADES;
    } else if (questionNumber === 5) {
      return DECADES.filter(decade => decade.id !== favoriteDecade1);
    }
    return [];
  };

  // Render a selection card
  const renderCard = (item: GenreItem | DecadeItem, isSelected: boolean, onSelect: () => void) => (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative cursor-pointer p-4 rounded-xl transition-all duration-200 w-full max-w-[180px] mx-auto ${
        isSelected 
          ? 'bg-white/20 shadow-lg transform scale-105' 
          : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="text-3xl mb-2">{item.icon}</div>
        <h4 className="text-md font-medium text-white">{item.id}</h4>
      </div>
      {isSelected && (
        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </motion.div>
  );

  // Render a completed question summary
  const renderCompletedQuestion = (questionNumber: number) => {
    let title = '';
    let selection = '';
    
    switch (questionNumber) {
      case 1:
        title = "First favorite genre";
        selection = favoriteGenre1 || '';
        break;
      case 2:
        title = "Second favorite genre";
        selection = favoriteGenre2 || '';
        break;
      case 3:
        title = "Genre you dislike";
        selection = dealBreakerGenre || '';
        break;
      case 4:
        title = "First favorite decade";
        selection = favoriteDecade1 || '';
        break;
      case 5:
        title = "Second favorite decade";
        selection = favoriteDecade2 || '';
        break;
      case 6:
        title = "Oldest movie you'd watch";
        selection = yearCutoff || '';
        break;
    }

    return (
      <motion.div 
        initial={{ height: 'auto' }}
        animate={{ height: '60px' }}
        className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-4 overflow-hidden"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-md font-medium text-white/70">{title}</h3>
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium">{selection}</span>
            <div className="bg-green-500/20 text-green-500 rounded-full p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </motion.div>
    );
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
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
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

          <div className="space-y-6">
            {/* Completed Questions */}
            <AnimatePresence>
              {currentStep > 1 && (
                <motion.div key="completed-1">
                  {renderCompletedQuestion(1)}
                </motion.div>
              )}
              {currentStep > 2 && (
                <motion.div key="completed-2">
                  {renderCompletedQuestion(2)}
                </motion.div>
              )}
              {currentStep > 3 && (
                <motion.div key="completed-3">
                  {renderCompletedQuestion(3)}
                </motion.div>
              )}
              {currentStep > 4 && (
                <motion.div key="completed-4">
                  {renderCompletedQuestion(4)}
                </motion.div>
              )}
              {currentStep > 5 && (
                <motion.div key="completed-5">
                  {renderCompletedQuestion(5)}
                </motion.div>
              )}
              {currentStep > 6 && (
                <motion.div key="completed-6">
                  {renderCompletedQuestion(6)}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Current Question */}
            <AnimatePresence mode="wait">
              {/* Question 1: First Favorite Genre */}
              {currentStep === 1 && (
                <motion.section 
                  key="q1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8"
                >
                  <h3 className="text-xl font-medium text-white/90 mb-6">
                    Select your first favorite genre
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {getAvailableGenres(1).map((genre) => (
                      <div key={genre.id}>
                        {renderCard(
                          genre, 
                          genre.id === favoriteGenre1,
                          () => handleGenreSelect(genre.id, 1)
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Question 2: Second Favorite Genre */}
              {currentStep === 2 && (
                <motion.section 
                  key="q2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8"
                >
                  <h3 className="text-xl font-medium text-white/90 mb-6">
                    Select your second favorite genre
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {getAvailableGenres(2).map((genre) => (
                      <div key={genre.id}>
                        {renderCard(
                          genre, 
                          genre.id === favoriteGenre2,
                          () => handleGenreSelect(genre.id, 2)
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Question 3: Genre Dealbreaker */}
              {currentStep === 3 && (
                <motion.section 
                  key="q3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8"
                >
                  <h3 className="text-xl font-medium text-white/90 mb-6">
                    Select a genre you dislike
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {getAvailableGenres(3).map((genre) => (
                      <div key={genre.id}>
                        {renderCard(
                          genre, 
                          genre.id === dealBreakerGenre,
                          () => handleGenreSelect(genre.id, 3)
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Question 4: First Favorite Decade */}
              {currentStep === 4 && (
                <motion.section 
                  key="q4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8"
                >
                  <h3 className="text-xl font-medium text-white/90 mb-6">
                    Select your first favorite decade
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {getAvailableDecades(4).map((decade) => (
                      <div key={decade.id}>
                        {renderCard(
                          decade, 
                          decade.id === favoriteDecade1,
                          () => handleDecadeSelect(decade.id, 4)
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Question 5: Second Favorite Decade */}
              {currentStep === 5 && (
                <motion.section 
                  key="q5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8"
                >
                  <h3 className="text-xl font-medium text-white/90 mb-6">
                    Select your second favorite decade
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {getAvailableDecades(5).map((decade) => (
                      <div key={decade.id}>
                        {renderCard(
                          decade, 
                          decade.id === favoriteDecade2,
                          () => handleDecadeSelect(decade.id, 5)
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Question 6: Year Cutoff */}
              {currentStep === 6 && (
                <motion.section 
                  key="q6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-8"
                >
                  <h3 className="text-xl font-medium text-white/90 mb-6">
                    What&apos;s the oldest movie you&apos;d watch?
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {DECADES.map((decade) => (
                      <div key={decade.id}>
                        {renderCard(
                          decade, 
                          decade.id === yearCutoff,
                          () => handleYearCutoffSelect(decade.id)
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Error Message */}
          {error && (
            <p className="mt-8 text-red-400 text-center font-light">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <p className="text-xl font-light text-white">Loading...</p>
        </div>
      )}

      {/* Loading Indicator when submitting */}
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-white border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
              <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                Loading...
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}