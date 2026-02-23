/**
 * RecordingIndicator - Shows pulsing mic icon and timer during recording
 */

import { useState, useEffect } from 'react';

export default function RecordingIndicator() {
  const [timeLeft, setTimeLeft] = useState(3.5);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newVal = prev - 0.1;
        return newVal < 0 ? 0 : newVal;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="recording-indicator">
      <div className="mic-pulse">
        <div className="pulse-ring pulse-ring-1"></div>
        <div className="pulse-ring pulse-ring-2"></div>
        <div className="pulse-ring pulse-ring-3"></div>
        <svg className="mic-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 16.91c-1.48 1.46-3.51 2.36-5.77 2.36-2.26 0-4.29-.9-5.77-2.36" />
        </svg>
      </div>
      <div className="recording-timer">
        {timeLeft.toFixed(1)}s
      </div>
    </div>
  );
}
