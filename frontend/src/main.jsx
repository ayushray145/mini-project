import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <App />
      </ClerkProvider>
    ) : (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#e5e7eb' }}>
        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code>. Add it to <code>frontend/.env</code> and restart the dev server.
      </div>
    )}
  </StrictMode>,
)
