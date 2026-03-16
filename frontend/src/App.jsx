import React, { useState } from 'react';
import { Show, SignIn, SignUp, UserButton, useUser } from '@clerk/react';
import Dashboard from './pages/Dashboard';
import ChatRoom from './pages/ChatRoom';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
import ChatHub from './pages/ChatHub';
import './App.css';

const themePresets = [
  { id: 'vercel-dark', label: 'Vercel Dark', tone: 'dark', bg: '#0b0d10', surface: '#111418', primary: '#f8fafc', secondary: '#3b82f6', onPrimary: '#0b0d10', onSecondary: '#fff', chatCardBg: '#151922', chatCardText: '#e2e8f0', chatMeta: '#94a3b8', chatBotBg: '#121a26' },
  { id: 'graphite-saas', label: 'Graphite SaaS', tone: 'dark', bg: '#0f1115', surface: '#151821', primary: '#e2e8f0', secondary: '#22c55e', onPrimary: '#0f1115', onSecondary: '#0b1410', chatCardBg: '#1a1f2b', chatCardText: '#e5e7eb', chatMeta: '#9aa4b2', chatBotBg: '#16211c' },
  { id: 'ocean-slate', label: 'Ocean Slate', tone: 'dark', bg: '#0b1220', surface: '#121a2b', primary: '#e0f2fe', secondary: '#38bdf8', onPrimary: '#0b1220', onSecondary: '#00121f', chatCardBg: '#182338', chatCardText: '#e0e7ff', chatMeta: '#93a4c7', chatBotBg: '#13223a' },
  { id: 'cloud-light', label: 'Cloud Light', tone: 'bright', bg: '#f8fafc', surface: '#ffffff', primary: '#0f172a', secondary: '#2563eb', onPrimary: '#fff', onSecondary: '#fff', chatCardBg: '#f1f5f9', chatCardText: '#0f172a', chatMeta: '#64748b', chatBotBg: '#e2e8f0' },
  { id: 'studio-light', label: 'Studio Light', tone: 'bright', bg: '#f7f7f9', surface: '#ffffff', primary: '#111827', secondary: '#0ea5e9', onPrimary: '#fff', onSecondary: '#fff', chatCardBg: '#eef2f7', chatCardText: '#111827', chatMeta: '#6b7280', chatBotBg: '#e6edf6' },
];

function App() {
  const [view, setView] = useState('landing');
  const [postAuthView, setPostAuthView] = useState('dashboard');
  const [activePreset, setActivePreset] = useState(themePresets[1]);
  const [chatRooms, setChatRooms] = useState(['general', 'backend', 'frontend', 'devops']);
  const [activeChatRoom, setActiveChatRoom] = useState('general');
  const [roomMembers, setRoomMembers] = useState({
    general: ['Ava', 'Noah', 'Mia (AI)', 'Liam', 'Sofia', 'Ethan'],
    backend: ['Noah', 'Liam', 'Ethan'],
    frontend: ['Ava', 'Mia (AI)', 'Sofia'],
    devops: ['Liam', 'Noah'],
  });
  const [account, setAccount] = useState(() => {
    const stored = localStorage.getItem('devrooms.account');
    return stored
      ? JSON.parse(stored)
      : {
          displayName: 'You',
          email: '',
          role: 'Developer',
          statusMessage: 'Building cool things',
        };
  });

  const { isLoaded: clerkLoaded, isSignedIn, user } = useUser();

  React.useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    const displayName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || 'User';
    const email = user?.primaryEmailAddress?.emailAddress || '';
    const clerkUserId = user?.id;
    const avatarUrl = user?.imageUrl;
    setAccount((prev) => {
      const next = { ...prev, clerkUserId, avatarUrl, displayName, email };
      localStorage.setItem('devrooms.account', JSON.stringify(next));
      return next;
    });
  }, [clerkLoaded, isSignedIn, user]);

  React.useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    if (view === 'sign-in' || view === 'sign-up') {
      setView(postAuthView || 'dashboard');
    }
  }, [clerkLoaded, isSignedIn, view, postAuthView]);

  const requireAuth = (nextView) => {
    if (isSignedIn) {
      setView(nextView);
      return;
    }
    setPostAuthView(nextView);
    setView('sign-in');
  };
  const isBrightPreset = activePreset.tone === 'bright';
  const themeVars = {
    '--neo-primary': activePreset.primary,
    '--neo-secondary': activePreset.secondary,
    '--neo-on-primary': activePreset.onPrimary,
    '--neo-on-secondary': activePreset.onSecondary,
    '--neo-bg': activePreset.bg,
    '--neo-surface': activePreset.surface,
    '--neo-chat-card-bg': activePreset.chatCardBg,
    '--neo-chat-card-text': activePreset.chatCardText,
    '--neo-chat-meta': activePreset.chatMeta,
    '--neo-chat-bot-bg': activePreset.chatBotBg,
    '--neo-text-main': isBrightPreset ? '#1f2937' : '#f2e8ff',
    '--neo-text-muted': isBrightPreset ? '#475569' : '#b9bed6',
    '--neo-on-surface': isBrightPreset ? '#111' : '#fff',
    '--neo-composer-bg': isBrightPreset ? activePreset.primary : activePreset.surface,
    '--neo-input-bg': isBrightPreset ? '#ffffff' : '#0f172a',
    '--neo-input-text': isBrightPreset ? '#111827' : '#e2e8f0',
    '--neo-input-placeholder': isBrightPreset ? '#6b7280' : '#94a3b8',
  };

  if (view === 'landing') {
    return (
      <Landing
        onEnterDashboard={() => requireAuth('dashboard')}
        onEnterChat={() => requireAuth('chat-hub')}
        themeVars={themeVars}
      />
    );
  }

  return (
    <div className="discord-app" style={themeVars}>
      <div className="discord-shell">
        <header className={`discord-topbar ${view === 'chat-hub' ? 'discord-topbar-clear' : ''}`}>
          <a
            href="#"
            className="brand"
            onClick={(event) => {
              event.preventDefault();
              setView('landing');
            }}
          >
            DevRooms
          </a>
          <div className="topbar-actions">
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => requireAuth('dashboard')}>
              Dashboard
            </button>
            <button className={view === 'chat' || view === 'chat-hub' ? 'active' : ''} onClick={() => requireAuth('chat-hub')}>
              Chat Room
            </button>
            <button className={view === 'settings' ? 'active' : ''} onClick={() => requireAuth('settings')}>
              Settings
            </button>
          </div>
          <div className="topbar-user">
            <Show when="signed-in">
              <UserButton />
            </Show>
            <Show when="signed-out">
              <button className="topbar-auth-btn" onClick={() => setView('sign-in')}>Sign in</button>
            </Show>
          </div>
        </header>

        <main className={`discord-workspace ${view === 'chat-hub' ? 'discord-workspace-clear discord-workspace-center' : ''}`}>
          <Show when="signed-out">
            <div className="auth-screen">
              {view === 'sign-up' ? <SignUp /> : <SignIn />}
              <div className="auth-switch">
                {view === 'sign-up' ? (
                  <button onClick={() => setView('sign-in')}>Have an account? Sign in</button>
                ) : (
                  <button onClick={() => setView('sign-up')}>New here? Create an account</button>
                )}
              </div>
            </div>
          </Show>

          <Show when="signed-in">
            {view === 'dashboard' && <Dashboard />}
            {view === 'chat-hub' && (
              <ChatHub
                onJoinExisting={() => setView('chat')}
                onCreateRoom={(name, members) => {
                  const slug = name
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-');
                  const roomId = slug || `room-${Date.now()}`;
                  setChatRooms((prev) => (prev.includes(roomId) ? prev : [...prev, roomId]));
                  setRoomMembers((prev) => ({ ...prev, [roomId]: members }));
                  setActiveChatRoom(roomId);
                  setView('chat');
                }}
                contacts={Object.values(roomMembers).flat().filter((value, index, arr) => arr.indexOf(value) === index)}
              />
            )}
            {view === 'chat' && (
              <ChatRoom
                onGoHome={() => setView('landing')}
                account={account}
                rooms={chatRooms}
                roomMembers={roomMembers}
                initialRoom={activeChatRoom}
              />
            )}
            {view === 'settings' && (
              <Settings
                presets={themePresets}
                activePreset={activePreset}
                onPresetChange={setActivePreset}
                account={account}
                onAccountChange={setAccount}
              />
            )}
          </Show>
        </main>
      </div>
    </div>
  );
}

export default App;
