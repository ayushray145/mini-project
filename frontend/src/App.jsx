import React, { useState } from 'react';
import { Show, SignIn, SignUp, UserButton, useAuth, useUser } from '@clerk/react';
import Dashboard from './pages/Dashboard';
import ChatRoom from './pages/ChatRoom';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
import ChatHub from './pages/ChatHub';
import CommunityHome from './pages/CommunityHome';
import CommunityModal from './component/ui/CommunityModal';
import { apiFetch } from './lib/api';
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

const CODEX_AI_MEMBER = 'Codex AI';
const isAnnouncementChannel = (channel) => {
  const name = String(channel?.name || '').trim().toLowerCase();
  const slug = String(channel?.slug || '').trim().toLowerCase();
  return Boolean(channel?.adminOnlyPosting) || name === 'announcement' || name === 'announcements' || slug.endsWith('-announcement') || slug.endsWith('-announcements');
};
const withDefaultChannelMembers = (members, channel) => {
  const baseMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  if (isAnnouncementChannel(channel)) return baseMembers;
  const nextMembers = [...baseMembers];
  if (!nextMembers.includes(CODEX_AI_MEMBER)) nextMembers.push(CODEX_AI_MEMBER);
  return nextMembers;
};

function App() {
  const [view, setView] = useState('landing');
  const [postAuthView, setPostAuthView] = useState('dashboard');
  const [communities, setCommunities] = useState([]);
  const [activeCommunityId, setActiveCommunityId] = useState('');
  const [activeChatRoom, setActiveChatRoom] = useState('general');
  const [roomLabels, setRoomLabels] = useState({});
  const [directMessages, setDirectMessages] = useState([]);
  const [communityModalOpen, setCommunityModalOpen] = useState(false);
  const [communityModalMode, setCommunityModalMode] = useState('create');
  const [roomMembers, setRoomMembers] = useState({
    general: ['Ava', 'Noah', 'Codex AI', 'Liam', 'Sofia', 'Ethan'],
    backend: ['Noah', 'Liam', 'Ethan'],
    frontend: ['Ava', 'Codex AI', 'Sofia'],
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
  const { getToken } = useAuth();

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
    if (view === 'landing') {
      setView('dashboard');
    }
  }, [clerkLoaded, isSignedIn, view]);

  React.useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !account?.clerkUserId) return;
    let cancelled = false;

    const loadCommunities = async () => {
      const resp = await apiFetch('/api/communities', {}, getToken);
      const data = await resp.json().catch(() => null);
      if (cancelled) return;
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to fetch communities');
      }
      const nextCommunities = Array.isArray(data.communities) ? data.communities : [];
      setCommunities(nextCommunities);
      setActiveCommunityId((prev) => {
        if (prev && nextCommunities.some((community) => community.id === prev)) return prev;
        return nextCommunities[0]?.id || '';
      });
    };

    loadCommunities().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, isSignedIn, account?.clerkUserId, getToken]);

  React.useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    if (view !== 'chat-hub') return;
    if (!account?.clerkUserId) return;

    let cancelled = false;
    apiFetch('/api/contacts', {}, getToken)
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
  }, [clerkLoaded, isSignedIn, view, account?.clerkUserId, getToken]);

  const requireAuth = (nextView) => {
    if (isSignedIn) {
      setView(nextView);
      return;
    }
    setPostAuthView(nextView);
    setView('sign-in');
  };

  const communityRooms = communities.map((community) => ({
    id: community.id,
    label: community.name,
    members: Array.isArray(community.members) ? community.members.length : 0,
    inviteCode: community.inviteCode,
    channels: community.channels || [],
    role: community.role,
    isAdmin: community.isAdmin,
  }));

  const ownedCommunities = communities.filter((community) => community.role === 'owner' || community.isAdmin);
  const ownedCommunityRooms = communityRooms.filter((community) => community.role === 'owner' || community.isAdmin);
  const hasDashboardAccess = ownedCommunityRooms.length > 0;

  const activeOwnedCommunity =
    ownedCommunities.find((community) => community.id === activeCommunityId) ||
    ownedCommunities[0] ||
    null;

  const activeCommunity =
    communities.find((community) => community.id === activeCommunityId) ||
    communities[0] ||
    null;

  const accessibleCommunityRooms = (activeCommunity?.channels || [])
    .filter((channel) => channel.isAccessible)
    .map((channel) => channel.roomId);

  const effectiveRoomLabels = {
    ...roomLabels,
    ...Object.fromEntries((activeCommunity?.channels || []).map((channel) => [channel.roomId, channel.name])),
  };

  const currentCommunityMemberMap = Object.fromEntries(
    (activeCommunity?.members || []).map((member) => [member.id, member.displayName]),
  );

  const effectiveRoomMembers = {
    ...roomMembers,
    ...Object.fromEntries(
      (activeCommunity?.channels || []).map((channel) => [
        channel.roomId,
        withDefaultChannelMembers(
          (channel.memberIds || []).map((memberId) => currentCommunityMemberMap[memberId]).filter(Boolean),
          channel,
        ),
      ]),
    ),
  };

  React.useEffect(() => {
    if (view !== 'chat') return;
    const nextRooms = [...accessibleCommunityRooms, ...directMessages.map((dm) => dm.roomId)];
    if (!nextRooms.length) return;
    if (!nextRooms.includes(activeChatRoom)) {
      setActiveChatRoom(nextRooms[0]);
    }
  }, [view, activeChatRoom, accessibleCommunityRooms, directMessages]);

  React.useEffect(() => {
    if (view !== 'community-dashboard') return;
    if (hasDashboardAccess) return;
    setView('dashboard');
  }, [view, hasDashboardAccess]);

  const upsertCommunity = (community) => {
    if (!community?.id) return;
    setCommunities((prev) => {
      const next = prev.some((item) => item.id === community.id)
        ? prev.map((item) => (item.id === community.id ? community : item))
        : [community, ...prev];
      return next;
    });
    setActiveCommunityId((prev) => prev || community.id);
  };

  const openCommunityById = (communityId, preferredRoomId) => {
    const community = communities.find((item) => item.id === communityId);
    if (!community) return;
    const accessible = (community.channels || []).filter((channel) => channel.isAccessible);
    const targetRoomId =
      preferredRoomId && accessible.some((channel) => channel.roomId === preferredRoomId)
        ? preferredRoomId
        : accessible[0]?.roomId;
    setActiveCommunityId(community.id);
    if (targetRoomId) setActiveChatRoom(targetRoomId);
    setView('chat');
    setCommunityModalOpen(false);
  };

  const openCommunityModal = (mode = 'create') => {
    setCommunityModalMode(mode);
    setCommunityModalOpen(true);
  };

  const closeCommunityModal = () => {
    setCommunityModalOpen(false);
  };

  const openCommunityRoom = (roomId) => {
    const ownerCommunity = communities.find((community) =>
      (community.channels || []).some((channel) => channel.roomId === roomId),
    );
    if (!ownerCommunity) return;
    openCommunityById(ownerCommunity.id, roomId);
  };

  const createCommunity = async ({ name, members = [] }) => {
    const memberEmails = (Array.isArray(members) ? members : [])
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean);
    const resp = await apiFetch('/api/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: account?.displayName,
        email: account?.email,
        name,
        memberEmails,
      }),
    }, getToken);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to create community');
    }
    upsertCommunity(data.community);
    setActiveCommunityId(data.community.id);
    setView('community-dashboard');
    setCommunityModalOpen(false);
  };

  const startDmByEmail = async (emailAddress) => {
    const resp = await apiFetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: account?.displayName,
        email: account?.email,
        contactEmail: emailAddress,
      }),
    }, getToken);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to add contact');
    }

    const dmRoom = data.dmRoom;
    const label = data.contact?.displayName || emailAddress;

    setRoomLabels((prev) => ({ ...prev, [dmRoom]: label }));
    setRoomMembers((prev) => ({ ...prev, [dmRoom]: [label] }));
    setDirectMessages((prev) => {
      if (prev.some((x) => x.roomId === dmRoom)) return prev;
      return [{ roomId: dmRoom, label }, ...prev];
    });

    setActiveChatRoom(dmRoom);
    setView('chat');
  };

  const joinCommunityByInvite = async (inviteCode) => {
    const resp = await apiFetch('/api/communities/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: account?.displayName,
        email: account?.email,
        inviteCode,
      }),
    }, getToken);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to join community');
    }
    upsertCommunity(data.community);
    setActiveCommunityId(data.community.id);
    if (data.community.channels?.[0]?.roomId) {
      setActiveChatRoom(data.community.channels[0].roomId);
    }
    setView('chat');
    setCommunityModalOpen(false);
  };

  const createCommunityChannel = async ({ name, memberIds = [] }) => {
    if (!activeCommunity?.id) throw new Error('No active community selected');
    const resp = await apiFetch(`/api/communities/${activeCommunity.id}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        memberIds,
      }),
    }, getToken);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to create channel');
    }
    upsertCommunity(data.community);
  };

  const updateChannelAccess = async (channelId, memberIds) => {
    if (!activeCommunity?.id) throw new Error('No active community selected');
    const resp = await apiFetch(`/api/communities/${activeCommunity.id}/channels/${channelId}/access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberIds,
      }),
    }, getToken);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to update channel access');
    }
    upsertCommunity(data.community);
  };

  const deleteCommunityChannel = async (channelId) => {
    if (!activeCommunity?.id) throw new Error('No active community selected');
    const resp = await apiFetch(
      `/api/communities/${activeCommunity.id}/channels/${channelId}`,
      { method: 'DELETE' },
      getToken,
    );
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to delete channel');
    }
    upsertCommunity(data.community);
    const deletedRoomId = data.deletedChannelId ? `channel:${data.deletedChannelId}` : '';
    const nextAccessibleRoom = (data.community?.channels || []).find((channel) => channel.isAccessible)?.roomId || '';
    if (deletedRoomId && activeChatRoom === deletedRoomId) {
      setActiveChatRoom(nextAccessibleRoom);
    }
  };

  const removeCommunityMember = async (memberId) => {
    if (!activeCommunity?.id) throw new Error('No active community selected');
    const resp = await apiFetch(
      `/api/communities/${activeCommunity.id}/members/${memberId}`,
      { method: 'DELETE' },
      getToken,
    );
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to remove member');
    }
    upsertCommunity(data.community);
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
          <div className="topbar-left">
            <a
              href="#"
              className="brand"
              onClick={(event) => {
                event.preventDefault();
                setView(isSignedIn ? 'dashboard' : 'landing');
              }}
            >
              DevRooms
            </a>
            {isSignedIn && hasDashboardAccess && (
              <button
                type="button"
                className={`topbar-dashboard-link ${view === 'community-dashboard' ? 'active' : ''}`}
                onClick={() => setView('community-dashboard')}
              >
                Dashboard
              </button>
            )}
          </div>
          <div className="topbar-user">
            <button
              type="button"
              className={`topbar-settings-icon ${view === 'settings' ? 'active' : ''}`}
              aria-label="Open settings"
              onClick={() => requireAuth('settings')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M19.4 13.5a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-1.1 1.1a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2a1 1 0 0 0-.6.9v.2a1.2 1.2 0 0 1-1.2 1.2h-1.6a1.2 1.2 0 0 1-1.2-1.2v-.2a1 1 0 0 0-.6-.9a1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0l-1.1-1.1a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1a1 1 0 0 0-.9-.6h-.2A1.2 1.2 0 0 1 2.5 12v-1.6a1.2 1.2 0 0 1 1.2-1.2h.2a1 1 0 0 0 .9-.6a1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7l1.1-1.1a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .5-.9v-.2A1.2 1.2 0 0 1 10.4 2.5H12a1.2 1.2 0 0 1 1.2 1.2v.2a1 1 0 0 0 .6.9a1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l1.1 1.1a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.5h.2a1.2 1.2 0 0 1 1.2 1.2V12a1.2 1.2 0 0 1-1.2 1.2h-.2a1 1 0 0 0-.9.3Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <Show when="signed-in">
              <UserButton />
            </Show>
            <Show when="signed-out">
              <button className="topbar-auth-btn" onClick={() => setView('sign-in')}>Sign in</button>
            </Show>
          </div>
        </header>

        <main className={`discord-workspace ${view === 'chat-hub' ? 'discord-workspace-clear discord-workspace-center' : ''} ${view === 'community-dashboard' ? 'discord-workspace-dashboard' : ''}`}>
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
            {view === 'dashboard' && (
              <CommunityHome
                onOpenCommunityModal={openCommunityModal}
              />
            )}
            {view === 'community-dashboard' && (
              <Dashboard
                communities={ownedCommunityRooms}
                activeCommunityId={activeOwnedCommunity?.id || ''}
                onOpenCommunityModal={openCommunityModal}
                onOpenCommunity={openCommunityById}
              />
            )}
            {view === 'chat-hub' && (
              <ChatHub
                onJoinExisting={(roomId) => {
                  if (typeof roomId === 'string' && roomId.startsWith('channel:')) {
                    openCommunityRoom(roomId);
                    return;
                  }
                  if (typeof roomId === 'string' && roomId) {
                    setActiveChatRoom(roomId);
                    setView('chat');
                    return;
                  }
                  const firstRoom = activeCommunity?.channels?.find((channel) => channel.isAccessible)?.roomId;
                  if (firstRoom) {
                    openCommunityRoom(firstRoom);
                  }
                }}
                onCreateRoom={(name, members) => {
                  const activeMemberIds =
                    members.length > 0
                      ? (activeCommunity?.members || [])
                          .filter((member) => members.includes(member.displayName))
                          .map((member) => member.id)
                      : [];
                  createCommunityChannel({ name, memberIds: activeMemberIds }).catch(() => {});
                }}
                contacts={(activeCommunity?.members || []).map((member) => member.displayName)}
                onStartDm={startDmByEmail}
                directMessages={directMessages}
              />
            )}
            {view === 'chat' && (
              <ChatRoom
                onGoHome={() => setView('landing')}
                account={account}
                rooms={[...accessibleCommunityRooms, ...directMessages.map((dm) => dm.roomId)]}
                roomLabels={effectiveRoomLabels}
                roomMembers={effectiveRoomMembers}
                initialRoom={activeChatRoom}
                community={activeCommunity}
                onCreateChannel={createCommunityChannel}
                onDeleteChannel={deleteCommunityChannel}
                onUpdateChannelAccess={updateChannelAccess}
                onRemoveCommunityMember={removeCommunityMember}
                getToken={getToken}
              />
            )}
            {view === 'settings' && (
              <Settings
                account={account}
                onAccountChange={setAccount}
              />
            )}

            {view !== 'chat' && view !== 'community-dashboard' && (
              <button
                type="button"
                className="community-fab"
                aria-label="Create or join a community"
                onClick={() => openCommunityModal('create')}
              >
                +
              </button>
            )}

            <CommunityModal
              isOpen={communityModalOpen}
              mode={communityModalMode}
              onClose={closeCommunityModal}
              onModeChange={setCommunityModalMode}
              communities={communityRooms}
              onCreateCommunity={createCommunity}
              onJoinCommunity={joinCommunityByInvite}
            />
          </Show>
        </main>
      </div>
    </div>
  );
}

export default App;
