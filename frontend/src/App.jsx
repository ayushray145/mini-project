import React, { useState } from 'react';
import { Show, SignIn, SignUp, UserButton, useUser } from '@clerk/react';
import Dashboard from './pages/Dashboard';
import ChatRoom from './pages/ChatRoom';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
import ChatHub from './pages/ChatHub';
import './App.css';

const globalTheme = {
  bg: '#03060d',
  surface: '#09111f',
  surfaceElevated: '#0f172a',
  primary: '#f8fafc',
  secondary: '#3b82f6',
  accent: '#60a5fa',
  onPrimary: '#03060d',
  onSecondary: '#eff6ff',
  chatCardBg: '#0f172a',
  chatCardText: '#e2e8f0',
  chatMeta: '#94a3b8',
  chatBotBg: '#111c31',
  textMain: '#f8fafc',
  textMuted: '#94a3b8',
  onSurface: '#e2e8f0',
  composerBg: '#09111f',
  inputBg: '#0b1424',
  inputText: '#e2e8f0',
  inputPlaceholder: '#64748b',
  border: 'rgba(148, 163, 184, 0.24)',
  borderStrong: 'rgba(148, 163, 184, 0.42)',
  shadow: '0 18px 48px rgba(2, 6, 23, 0.32)',
  shadowSoft: '0 10px 28px rgba(15, 23, 42, 0.2)',
};

function App() {
  const [view, setView] = useState('landing');
  const [postAuthView, setPostAuthView] = useState('dashboard');
  const [chatRooms, setChatRooms] = useState(['general', 'backend', 'frontend', 'devops']);
  const [activeChatRoom, setActiveChatRoom] = useState('general');
  const [roomLabels, setRoomLabels] = useState({});
  const [directMessages, setDirectMessages] = useState([]);
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

  React.useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    if (view !== 'chat-hub') return;
    if (!account?.clerkUserId) return;

    let cancelled = false;
    fetch(`/api/contacts?clerkUserId=${encodeURIComponent(account.clerkUserId)}`)
      .then((resp) => resp.json().then((data) => ({ resp, data })).catch(() => ({ resp, data: null })))
      .then(({ resp, data }) => {
        if (cancelled) return;
        if (!resp.ok || !data?.ok) return;
        const list = Array.isArray(data.contacts) ? data.contacts : [];
        const dms = list
          .filter((x) => x?.dmRoom && x?.contact?.displayName)
          .map((x) => ({ roomId: x.dmRoom, label: x.contact.displayName }));
        setDirectMessages(dms);

        // Ensure DM rooms appear in the chat room list with labels.
        setChatRooms((prev) => {
          const next = [...prev];
          for (const dm of dms) {
            if (!next.includes(dm.roomId)) next.push(dm.roomId);
          }
          return next;
        });
        setRoomLabels((prev) => {
          const next = { ...prev };
          for (const dm of dms) next[dm.roomId] = dm.label;
          return next;
        });
        setRoomMembers((prev) => {
          const next = { ...prev };
          for (const dm of dms) next[dm.roomId] = [dm.label];
          return next;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, isSignedIn, view, account?.clerkUserId]);

  const requireAuth = (nextView) => {
    if (isSignedIn) {
      setView(nextView);
      return;
    }
    setPostAuthView(nextView);
    setView('sign-in');
  };

  const startDmByEmail = async (emailAddress) => {
    const resp = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkUserId: account?.clerkUserId,
        displayName: account?.displayName,
        email: account?.email,
        contactEmail: emailAddress,
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to add contact');
    }

    const dmRoom = data.dmRoom;
    const label = data.contact?.displayName || emailAddress;

    setChatRooms((prev) => (prev.includes(dmRoom) ? prev : [...prev, dmRoom]));
    setRoomLabels((prev) => ({ ...prev, [dmRoom]: label }));
    setRoomMembers((prev) => ({ ...prev, [dmRoom]: [label] }));
    setDirectMessages((prev) => {
      if (prev.some((x) => x.roomId === dmRoom)) return prev;
      return [{ roomId: dmRoom, label }, ...prev];
    });

    setActiveChatRoom(dmRoom);
    setView('chat');
  };
  const themeVars = {
    '--neo-primary': globalTheme.primary,
    '--neo-secondary': globalTheme.secondary,
    '--neo-accent': globalTheme.accent,
    '--neo-on-primary': globalTheme.onPrimary,
    '--neo-on-secondary': globalTheme.onSecondary,
    '--neo-bg': globalTheme.bg,
    '--neo-surface': globalTheme.surface,
    '--neo-surface-elevated': globalTheme.surfaceElevated,
    '--neo-chat-card-bg': globalTheme.chatCardBg,
    '--neo-chat-card-text': globalTheme.chatCardText,
    '--neo-chat-meta': globalTheme.chatMeta,
    '--neo-chat-bot-bg': globalTheme.chatBotBg,
    '--neo-text-main': globalTheme.textMain,
    '--neo-text-muted': globalTheme.textMuted,
    '--neo-on-surface': globalTheme.onSurface,
    '--neo-composer-bg': globalTheme.composerBg,
    '--neo-input-bg': globalTheme.inputBg,
    '--neo-input-text': globalTheme.inputText,
    '--neo-input-placeholder': globalTheme.inputPlaceholder,
    '--saas-border': globalTheme.border,
    '--saas-border-strong': globalTheme.borderStrong,
    '--saas-shadow': globalTheme.shadow,
    '--saas-shadow-soft': globalTheme.shadowSoft,
  };

  if (view === 'landing') {
    return (
      <Landing
        onEnterDashboard={() => requireAuth('dashboard')}
        onEnterChat={() => requireAuth('chat-hub')}
        onLogin={() => {
          setPostAuthView('dashboard');
          setView('sign-in');
        }}
        onSignup={() => {
          setPostAuthView('dashboard');
          setView('sign-up');
        }}
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
                onJoinExisting={(roomId) => {
                  if (typeof roomId === 'string' && roomId) {
                    setActiveChatRoom(roomId);
                  }
                  setView('chat');
                }}
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
                onStartDm={startDmByEmail}
                directMessages={directMessages}
              />
            )}
            {view === 'chat' && (
              <ChatRoom
                onGoHome={() => setView('landing')}
                account={account}
                rooms={chatRooms}
                roomLabels={roomLabels}
                roomMembers={roomMembers}
                initialRoom={activeChatRoom}
              />
            )}
            {view === 'settings' && (
              <Settings
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
