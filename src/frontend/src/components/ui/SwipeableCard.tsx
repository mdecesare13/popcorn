import React, { useState } from 'react';
import { useSwipeable } from 'react-swipeable';

interface Movie {
  movie_id: string;
  year: number;
  image_url: string;
  blind_summary: string;
  ratings: {
    source: string;
    score: string;
    max_score: string;
  }[];
}

interface SwipeableCardProps {
  movie: Movie;
  onVote: (movieId: string, vote: 'yes' | 'no') => void;
  isActive: boolean;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({ movie, onVote, isActive }) => {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isVoting, setIsVoting] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!isActive || isVoting) return;
      
      const offset = eventData.deltaX;
      setSwipeOffset(offset);
      
      if (offset > 50) {
        setSwipeDirection('right');
      } else if (offset < -50) {
        setSwipeDirection('left');
      } else {
        setSwipeDirection(null);
      }
    },
    onSwiped: (eventData) => {
      if (!isActive || isVoting) return;
      
      // If swiped far enough, trigger vote
      if (eventData.absX > 100) {
        setIsVoting(true);
        if (eventData.dir === 'Left') {
          onVote(movie.movie_id, 'no');
        } else if (eventData.dir === 'Right') {
          onVote(movie.movie_id, 'yes');
        }
      } else {
        // Reset if not swiped far enough
        setSwipeOffset(0);
        setSwipeDirection(null);
      }
    },
    trackMouse: true,
  });

  // Calculate rotation and opacity based on swipe
  const rotation = swipeOffset / 20; // Rotate slightly as user swipes
  const opacity = Math.min(Math.abs(swipeOffset) / 100, 1);

  // Handle button clicks
  const handleNoClick = () => {
    if (!isActive || isVoting) return;
    setIsVoting(true);
    onVote(movie.movie_id, 'no');
  };

  const handleYesClick = () => {
    if (!isActive || isVoting) return;
    setIsVoting(true);
    onVote(movie.movie_id, 'yes');
  };

  // Calculate button background opacity based on swipe direction
  const noButtonOpacity = swipeDirection === 'left' ? 0.3 + opacity * 0.7 : 0.3;
  const yesButtonOpacity = swipeDirection === 'right' ? 0.3 + opacity * 0.7 : 0.3;

  return (
    <div
      {...handlers}
      className={`absolute w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-transform duration-200 ${!isActive && 'pointer-events-none'}`}
      style={{
        transform: isActive ? `translateX(${swipeOffset}px) rotate(${rotation}deg)` : 'scale(0.95)',
        zIndex: isActive ? 10 : 5,
      }}
    >
      <div className="relative h-full">
        {/* Solid background to prevent seeing through */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Blurred Movie Image */}
        <div 
          className="absolute inset-0 blur-3xl"
          style={{
            backgroundImage: `url(${movie.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-black/60" />

        {/* Content */}
        <div className="relative h-full flex flex-col p-8">
          {/* Movie Info - Scrollable Area */}
          <div className="flex-1 overflow-y-auto mb-8">
            <p className="text-2xl font-medium text-white mb-2">
              {movie.year}
            </p>
            <p className="text-lg font-light text-white/80 leading-relaxed line-clamp-[12]">
              {movie.blind_summary}
            </p>

            {/* Ratings */}
            <div className="space-y-2 mt-4">
              {movie.ratings.map((rating, i) => (
                <div key={i} className="flex justify-between items-center text-white/70">
                  <span className="font-light truncate mr-4">{rating.source}</span>
                  <span className="font-medium whitespace-nowrap">{rating.score}/{rating.max_score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vote Buttons */}
          <div className="flex justify-center gap-12 mt-auto">
            <button
              onClick={handleNoClick}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
              style={{ 
                backgroundColor: `rgba(239, 68, 68, ${noButtonOpacity})`,
              }}
            >
              {/* Left Arrow Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <button
              onClick={handleYesClick}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
              style={{ 
                backgroundColor: `rgba(52, 211, 153, ${yesButtonOpacity})`,
              }}
            >
              {/* Right Arrow Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwipeableCard; 