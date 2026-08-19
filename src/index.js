import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';

const savedTheme =
  localStorage.getItem('shuttleTheme') || 'light';

document.documentElement.setAttribute(
  'data-theme',
  savedTheme
);

const root = ReactDOM.createRoot(
  document.getElementById('root')
);

root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

reportWebVitals();