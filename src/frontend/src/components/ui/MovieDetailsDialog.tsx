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
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 
                                 bg-[#1a1f2c] rounded-2xl p-8 shadow-xl z-[70]">
          <div className="flex gap-8">
            {/* Image */}
            <div className="w-1/3">
              <div className="aspect-[2/3] relative rounded-lg overflow-hidden">
                <img 
                  src={movie.image_url} 
                  alt={movie.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Add the same gradient overlay as main view */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/40" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <Dialog.Title className="text-3xl font-medium text-white mb-2">
                {movie.title}
              </Dialog.Title>
              
              <p className="text-xl font-light text-white/70 mb-6">{movie.year}</p>
              
              <p className="text-lg font-light text-white/80 leading-relaxed mb-8">
                {movie.blind_summary}
              </p>
              
              {/* Ratings */}
              <div className="space-y-3">
                {movie.ratings.map((rating, i) => (
                  <div key={i} className="flex justify-between items-center text-white/70">
                    <span className="font-light">{rating.source}</span>
                    <span className="font-medium">{rating.score}/{rating.max_score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Close button */}
          <Dialog.Close className="absolute right-6 top-6 text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MovieDetailsDialog;