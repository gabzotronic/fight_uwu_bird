/**
 * PitchProgression - Shows pitch contours across all rounds
 * Displays the escalation of both template and player pitches
 */

import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

export default function PitchProgression({ allRounds }) {
  const plotRef = useRef(null);

  useEffect(() => {
    if (!plotRef.current || !allRounds || allRounds.length === 0) {
      return;
    }

    // Convert frames to seconds (512 hop_length, 44100 Hz sample rate)
    const frameToSeconds = 512 / 44100;

    // Create traces for each round
    const traces = [];
    const colors = ['#e74c3c', '#f39c12', '#2ecc71']; // Red, Orange, Green
    const colorsDark = ['#c0392b', '#d68910', '#27ae60']; // Darker versions

    // Process each round
    allRounds.forEach((roundData, idx) => {
      const timeSeconds = roundData.time_frames.map((f) => f * frameToSeconds);

      // Template trace (bird's call) for this round
      const templateTrace = {
        x: timeSeconds,
        y: roundData.template_contour,
        mode: 'lines',
        name: `Bird Round ${roundData.round}`,
        line: {
          color: colors[idx],
          width: 3,
          dash: 'dash', // Dashed for template
        },
        hovertemplate: `<b>Bird (R${roundData.round})</b><br>Time: %{x:.2f}s<br>Pitch: %{y:.1f} ST<extra></extra>`,
      };

      // Player trace for this round
      const playerTrace = {
        x: timeSeconds,
        y: roundData.player_contour,
        mode: 'lines',
        name: `You Round ${roundData.round}`,
        line: {
          color: colorsDark[idx],
          width: 2,
        },
        hovertemplate: `<b>You (R${roundData.round})</b><br>Time: %{x:.2f}s<br>Pitch: %{y:.1f} ST<extra></extra>`,
      };

      traces.push(templateTrace);
      traces.push(playerTrace);
    });

    const layout = {
      title: {
        text: 'Pitch Progression Across All Rounds',
        font: { size: 18, color: '#eaeaea' },
      },
      xaxis: {
        title: 'Time (seconds)',
        color: '#95a5a6',
        gridcolor: 'rgba(255, 255, 255, 0.1)',
      },
      yaxis: {
        title: 'Pitch (semitones relative to your median)',
        color: '#95a5a6',
        gridcolor: 'rgba(255, 255, 255, 0.1)',
      },
      plot_bgcolor: 'rgba(22, 33, 62, 0.5)',
      paper_bgcolor: 'rgba(26, 26, 46, 0.8)',
      hovermode: 'x unified',
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        bordercolor: '#555',
        borderwidth: 1,
        font: { color: '#eaeaea' },
      },
      margin: {
        l: 60,
        r: 30,
        t: 60,
        b: 50,
      },
      height: 500,
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      staticPlot: false,
    };

    Plotly.newPlot(plotRef.current, traces, layout, config);

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [allRounds]);

  if (!allRounds || allRounds.length === 0) {
    return null;
  }

  return (
    <div className="pitch-progression">
      <div className="progression-info">
        <p className="progression-title">Your Pitch Journey</p>
        <p className="progression-subtitle">
          Watch how you matched the bird's escalating call across {allRounds.length} rounds
        </p>
      </div>
      <div ref={plotRef} className="plotly-container"></div>
    </div>
  );
}
