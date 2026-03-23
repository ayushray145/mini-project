import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
const hasValidClerkKey = Boolean(clerkPubKey && clerkPubKey.startsWith('pk_'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {hasValidClerkKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <App />
      </ClerkProvider>
    ) : (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#e5e7eb' }}>
        Missing or invalid <code>VITE_CLERK_PUBLISHABLE_KEY</code>. Add a real Clerk publishable key to <code>frontend/.env</code>, confirm <code>VITE_API_BASE_URL</code>, and restart the dev server.
      </div>
    )}
  </StrictMode>,
)
