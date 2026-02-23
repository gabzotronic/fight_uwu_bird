/**
 * PitchVisualizer - Displays pitch contour comparison using Plotly.js
 * Shows the template (bird's call) vs user's recorded call
 */

import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

export default function PitchVisualizer({ analysis }) {
  const plotRef = useRef(null);

  useEffect(() => {
    if (!plotRef.current || !analysis?.pitch_visualization) {
      return;
    }

    const viz = analysis.pitch_visualization;
    const playerContour = viz.player_contour;
    const templateContour = viz.template_contour;
    const timeFrames = viz.time_frames;

    // Convert frames to seconds (assuming 512 hop_length, 44100 Hz sample rate)
    // Each frame = 512 samples / 44100 Hz = ~0.0116 seconds
    const hopLength = 512;
    const sampleRate = 44100;
    const frameToSeconds = (hopLength / sampleRate);
    const timeSeconds = timeFrames.map((f) => f * frameToSeconds);

    // Calculate pitch tolerance zone in semitones
    const tolerance = viz.pitch_tolerance_semitones || 5.0;
    const playerMedianHz = viz.player_median_pitch_hz;
    const targetHz = viz.target_pitch_hz;

    // Convert target Hz to semitones relative to player's median
    const targetSemitones =
      playerMedianHz > 0
        ? 12 * Math.log2(targetHz / playerMedianHz)
        : 0;

    // Create traces
    const templateTrace = {
      x: timeSeconds,
      y: templateContour,
      mode: 'lines',
      name: 'Bird Call (Template)',
      line: {
        color: '#2ecc71',
        width: 2,
      },
      hovertemplate: '<b>Template</b><br>Time: %{x:.2f}s<br>Pitch: %{y:.1f} ST<extra></extra>',
    };

    const playerTrace = {
      x: timeSeconds,
      y: playerContour,
      mode: 'lines',
      name: 'Your Call',
      line: {
        color: '#3498db',
        width: 2,
      },
      hovertemplate: '<b>Your Call</b><br>Time: %{x:.2f}s<br>Pitch: %{y:.1f} ST<extra></extra>',
    };

    // Add tolerance zone as a filled area
    const toleranceTrace = {
      x: [...timeSeconds, ...timeSeconds.slice().reverse()],
      y: [
        ...timeSeconds.map(() => targetSemitones + tolerance),
        ...timeSeconds
          .slice()
          .reverse()
          .map(() => targetSemitones - tolerance),
      ],
      fill: 'toself',
      fillcolor: 'rgba(244, 208, 63, 0.15)',
      line: { color: 'transparent' },
      name: 'Acceptable Pitch Range',
      hoverinfo: 'skip',
    };

    const layout = {
      title: {
        text: 'Pitch Contour Comparison',
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
      height: 400,
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      staticPlot: false,
    };

    // Clear previous plot if exists
    Plotly.newPlot(
      plotRef.current,
      [toleranceTrace, templateTrace, playerTrace],
      layout,
      config
    );

    return () => {
      // Cleanup on unmount
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [analysis]);

  if (!analysis?.pitch_visualization) {
    return null;
  }

  return (
    <div className="pitch-visualizer">
      <div ref={plotRef} className="plotly-container"></div>
    </div>
  );
}
