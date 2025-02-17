import React from 'react';

interface MovieVotes {
  movie_id: string;
  title: string;
  image_url: string;  // Added this
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
    <div className="w-full space-y-6">
      {sortedData.map((item) => {
        const total = item.yes_votes + item.no_votes;
        const yesPercentage = total > 0 ? (item.yes_votes / total) * 100 : 0;
        const noPercentage = total > 0 ? (item.no_votes / total) * 100 : 0;

        return (
          <div 
            key={item.movie_id}
            className="group relative cursor-pointer flex items-center gap-4"
            onClick={() => onBarClick(item.movie_id)}
          >
            {/* Movie Poster */}
            <div className="flex-shrink-0 w-16 h-24">
              <img 
                src={item.image_url} 
                alt={item.title}
                className="w-full h-full object-cover rounded-md shadow-md"
              />
            </div>

            {/* Bar and Votes Section */}
            <div className="flex-grow">
              {/* Bar container with votes directly underneath */}
              <div>
                {/* Bar */}
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

                {/* Vote counts - directly under bar */}
                <div className="mt-1">
                  <span className="text-gray-300 text-sm">
                    Yes: {item.yes_votes} | No: {item.no_votes}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BarChart;