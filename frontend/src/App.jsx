import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import ChatRoom from './pages/ChatRoom';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
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
  const [activePreset, setActivePreset] = useState(themePresets[1]);
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
        onEnterDashboard={() => setView('dashboard')}
        onEnterChat={() => setView('chat')}
        themeVars={themeVars}
      />
    );
  }

  return (
    <div className="discord-app" style={themeVars}>
      <aside className="server-rail">
        <button className={`server-pill ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>DR</button>
        <button className={`server-pill ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>AI</button>
        <button className="server-pill">JS</button>
        <button className="server-pill" onClick={() => setView('landing')}>+</button>
      </aside>

      <div className="discord-shell">
        <header className="discord-topbar">
          <button type="button" className="brand" onClick={() => setView('landing')}>
            DevRooms
          </button>
          <div className="topbar-actions">
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
              Dashboard
            </button>
            <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>
              Chat Room
            </button>
            <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
              Settings
            </button>
          </div>
        </header>

        <main className="discord-workspace">
          {view === 'dashboard' && <Dashboard />}
          {view === 'chat' && <ChatRoom onGoHome={() => setView('landing')} account={account} />}
          {view === 'settings' && (
            <Settings
              presets={themePresets}
              activePreset={activePreset}
              onPresetChange={setActivePreset}
              account={account}
              onAccountChange={setAccount}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
