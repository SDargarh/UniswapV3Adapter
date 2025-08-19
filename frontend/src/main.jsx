import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import { Web3Provider } from './providers/Web3Provider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </React.StrictMode>,
);