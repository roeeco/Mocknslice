import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
import './styles/studio.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('MocknSlice could not find its application root.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
