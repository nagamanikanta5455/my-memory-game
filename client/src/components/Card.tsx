import './Card.css';

interface CardProps {
  content: string;
  isFlipped: boolean;
  isMatch: boolean;
  isError: boolean;
  index: number; // NEW: We need the index to stagger the animation
  onClick: () => void;
}

export default function Card({ content, isFlipped, isMatch, isError, index, onClick }: CardProps) {
  return (
    <div 
      className={`card ${isFlipped ? 'flipped' : ''} ${isMatch ? 'match' : ''} ${isError ? 'error' : ''}`} 
      onClick={onClick}
      // THE FIX: Creates a cascading delay. Card 1 animates instantly, Card 2 waits 0.03s, etc.
      style={{ animationDelay: `${index * 0.03}s` }} 
    >
      <div className="card-inner">
        <div className="card-back"></div>
        <div className="card-front">{content}</div>
      </div>
    </div>
  );
}