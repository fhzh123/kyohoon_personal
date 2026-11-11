// Integration-only entry. App, content modules and styles are unmodified copies.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
