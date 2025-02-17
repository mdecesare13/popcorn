import React from 'react';

interface MovieVotes {
  movie_id: string;
  title: string;
  yes_votes: number;
  no_votes: number;
}

interface BarChartProps {
  data: MovieVotes[];
  onBarClick: (movieId: string) => void;
}

const BarChart = ({ data, onBarClick }: BarChartProps) => {
  // Sort data by yes votes in descending order
  const sortedData = [...data].sort((a, b) => b.yes_votes - a.yes_votes);

  return (
    <div className="w-full space-y-4">
      {sortedData.map((item) => {
        const total = item.yes_votes + item.no_votes;
        const yesPercentage = total > 0 ? (item.yes_votes / total) * 100 : 0;
        const noPercentage = total > 0 ? (item.no_votes / total) * 100 : 0;

        return (
          <div 
            key={item.movie_id}
            className="group relative cursor-pointer"
            onClick={() => onBarClick(item.movie_id)}
          >
            {/* Title and vote counts */}
            <div className="flex justify-between mb-2">
              <span className="font-medium text-white">{item.title}</span>
              <span className="text-gray-300">
                Yes: {item.yes_votes} | No: {item.no_votes}
              </span>
            </div>

            {/* Bar container */}
            <div className="h-8 w-full bg-gray-700 rounded-lg overflow-hidden relative">
              {/* Yes votes */}
              <div 
                className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500 ease-in-out"
                style={{ width: `${yesPercentage}%` }}
              />
              {/* No votes */}
              <div 
                className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-500 ease-in-out"
                style={{ width: `${noPercentage}%` }}
              />

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BarChart;