import React from 'react';
import { Highlight } from '../types';

interface TimelineProps {
  duration: number;
  highlights: Highlight[];
  onSeek: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ duration, highlights, onSeek }) => {
  return (
    <div className="w-full h-8 relative mt-4 mb-6 group cursor-pointer">
      {/* Background Track */}
      <div className="absolute top-0 left-0 w-full h-full bg-gray-100 rounded-lg overflow-hidden">
        {/* Render colored segments */}
        {highlights.map((highlight) => {
          const widthPercent = ((highlight.endTime - highlight.startTime) / duration) * 100;
          const leftPercent = (highlight.startTime / duration) * 100;

          return (
            <div
              key={highlight.id}
              className="absolute top-0 h-full opacity-60 hover:opacity-100 transition-opacity duration-200"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                backgroundColor: highlight.color,
              }}
              title={`${highlight.title} (${Math.floor(highlight.startTime / 60)}:${(highlight.startTime % 60).toString().padStart(2, '0')})`}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(highlight.startTime);
              }}
            />
          );
        })}
      </div>
      
      {/* Visual Guide on Hover (optional, just adds a subtle interact hint) */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none border border-gray-200 rounded-lg"></div>
    </div>
  );
};

export default Timeline;