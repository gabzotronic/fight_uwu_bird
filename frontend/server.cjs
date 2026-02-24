const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = (process.env.VITE_API_URL || 'https://uwubackend-production.up.railway.app').replace(/\/$/, '');

// Proxy /share to backend (serves dynamic OG tags for WhatsApp/social previews)
app.get('/share', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const url = `${BACKEND_URL}/share${qs ? '?' + qs : ''}`;
    const response = await fetch(url);
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error fetching share page');
  }
});

// Serve static dist files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
