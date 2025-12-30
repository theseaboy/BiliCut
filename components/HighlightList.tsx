import React from 'react';
import { Play } from 'lucide-react';
import { Highlight } from '../types';

interface HighlightListProps {
  highlights: Highlight[];
  onSeek: (time: number) => void;
}

const HighlightList: React.FC<HighlightListProps> = ({ highlights, onSeek }) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      {highlights.map((highlight) => (
        <div 
          key={highlight.id}
          onClick={() => onSeek(highlight.startTime)}
          className="group flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
        >
          {/* Color Dot */}
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0 mr-4"
            style={{ backgroundColor: highlight.color }}
          />
          
          <div className="flex-grow min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {highlight.title}
            </h4>
            {highlight.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {highlight.description}
              </p>
            )}
          </div>

          <div className="flex items-center text-xs text-gray-400 font-mono ml-3">
             <span className="opacity-0 group-hover:opacity-100 mr-2 transition-opacity">
                <Play size={12} fill="currentColor" />
             </span>
             {formatTime(highlight.startTime)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HighlightList;