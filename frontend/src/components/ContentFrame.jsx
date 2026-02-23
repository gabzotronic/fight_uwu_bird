import React, { useEffect } from 'react';
import { useTypewriter } from '../hooks/useTypewriter';
import Plot from 'react-plotly.js';

/**
 * Content frame displaying either typewriter text or Plotly chart
 */
export default function ContentFrame({
  mode = 'text',
  text = '',
  textSpeed = 50,
  onTextComplete,
  chartData = [],
  chartLayout = {},
}) {
  const { displayed, done } = useTypewriter(mode === 'text' ? text : '', textSpeed);

  // Fire callback when text animation completes
  useEffect(() => {
    if (done && mode === 'text' && onTextComplete) {
      onTextComplete();
    }
  }, [done, mode, onTextComplete]);

  return (
    <div className="framed neutral content-frame">
      {mode === 'text' ? (
        <div className="typewriter-text">
          <span style={{ display: 'block' }}>{displayed}</span>
          {done && <span className="cursor">▼</span>}
        </div>
      ) : (
        <div className="content-frame__chart">
          <Plot
            data={chartData}
            layout={{
              ...chartLayout,
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { family: 'monospace', size: 9, color: '#181010' },
              margin: { l: 45, r: 8, t: 8, b: 35 },
              showlegend: false,
              hovermode: false,
              xaxis: {
                ...chartLayout.xaxis,
                showticklabels: true,
                color: '#181010',
                tickcolor: '#181010',
                gridcolor: 'rgba(24,16,16,0.15)',
                title: { text: chartLayout.xaxis?.title?.text ?? '', font: { color: '#181010', size: 9 } },
              },
              yaxis: {
                ...chartLayout.yaxis,
                showticklabels: true,
                color: '#181010',
                tickcolor: '#181010',
                gridcolor: 'rgba(24,16,16,0.15)',
                title: { text: chartLayout.yaxis?.title?.text ?? '', font: { color: '#181010', size: 9 } },
              },
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
