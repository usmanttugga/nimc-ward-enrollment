import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Redirect old Firebase URL to custom domain
if (window.location.hostname === 'nimc-ward-enrollment.web.app') {
  window.location.replace(
    'https://enrollment.2plustech.com.ng' + window.location.pathname + window.location.search
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
