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
  className?: string;
}

const MovieDetailsDialog = ({ movie, isOpen, onClose, className }: MovieDetailsDialogProps) => {
  if (!movie) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100]">
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[101]" />
          <Dialog.Content 
            className={`relative bg-[#1a1f2c] rounded-2xl p-8 shadow-xl z-[102] ${className} overflow-hidden`}
          >
            {/* Blurred background image */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url(${movie.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            
            {/* Content */}
            <div className="relative z-10">
              <Dialog.Title className="text-3xl font-medium text-white mb-2">
                {movie.title}
              </Dialog.Title>
              
              <p className="text-xl font-light text-white/70 mb-6">{movie.year}</p>
              
              <Dialog.Description asChild>
                <p className="text-lg font-light text-white/80 leading-relaxed mb-8">
                  {movie.blind_summary}
                </p>
              </Dialog.Description>
              
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

            {/* Close button */}
            <Dialog.Close className="absolute right-6 top-6 text-white/70 hover:text-white transition-colors z-20">
              <X size={24} />
            </Dialog.Close>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MovieDetailsDialog;