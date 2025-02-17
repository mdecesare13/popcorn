import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface MovieDetails {
  movie_id: string;
  title: string;
  year: number;
  image_url: string;
  blind_summary: string;
  ratings: {
    source: string;
    score: string;
    max_score: string;
  }[];
}

interface MovieDetailsDialogProps {
  movie: MovieDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

const MovieDetailsDialog = ({ movie, isOpen, onClose }: MovieDetailsDialogProps) => {
  if (!movie) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-[#1a1f2c] rounded-lg p-6 shadow-xl">
          <div className="flex gap-6">
            {/* Image */}
            <div className="w-1/3">
              <img 
                src={movie.image_url} 
                alt={movie.title}
                className="w-full rounded-lg shadow-md"
              />
            </div>

            {/* Content */}
            <div className="w-2/3">
              <Dialog.Title className="text-2xl font-bold text-white mb-2">
                {movie.title}
              </Dialog.Title>
              
              <p className="text-gray-400 mb-4">{movie.year}</p>
              
              <p className="text-gray-300 mb-6">{movie.blind_summary}</p>
              
              {/* Ratings */}
              <div className="space-y-2">
                {movie.ratings.map((rating, i) => (
                  <div key={i} className="text-sm text-gray-300">
                    {rating.source}: {rating.score}/{rating.max_score}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Close button */}
          <Dialog.Close className="absolute right-4 top-4 text-gray-400 hover:text-white">
            <X size={24} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MovieDetailsDialog;