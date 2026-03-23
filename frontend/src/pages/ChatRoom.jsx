import { useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { createPusherClient } from '../lib/pusher';

const defaultRooms = ['general', 'backend', 'frontend', 'devops'];
const defaultMembers = ['Ava', 'Noah', 'Codex AI', 'Liam', 'Sofia', 'Ethan'];
const CODEX_AI_MEMBER = 'Codex AI';

const makeMessageId = () =>
  `m-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatMessageTime = (value) => {
  if (!value) return getCurrentTime();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getCurrentTime();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeMessage = (payload) => ({
  id: payload.id || makeMessageId(),
  user: payload.username,
  senderId: payload.senderId || payload.clerkUserId || payload.clientId || '',
  time: formatMessageTime(payload.time),
  text: payload.message || payload.text || '',
  isBot: payload.isBot,
});

export default function ChatRoom({
  account,
  rooms = defaultRooms,
  roomLabels = {},
  roomMembers,
  initialRoom,
  community,
  onCreateChannel,
  onDeleteChannel,
  onUpdateChannelAccess,
  onRemoveCommunityMember,
}) {
  const canvasRef = useRef(null);
  const messageListRef = useRef(null);
  const inputRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const activeRoomRef = useRef('general');
  const [clientId] = useState(() => {
    const storedId = window.localStorage.getItem('chat_client_id');
    const generated =
      storedId ||
      `c-${
        window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      }`;
    window.localStorage.setItem('chat_client_id', generated);
    return generated;
  });
  const [brushColor, setBrushColor] = useState('#111111');
  const [brushSize, setBrushSize] = useState(4);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [historyWarning, setHistoryWarning] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [adminStatusTone, setAdminStatusTone] = useState('info');
  const [channelAccessDrafts, setChannelAccessDrafts] = useState({});
  const [openChannelMenuId, setOpenChannelMenuId] = useState('');
  const [username] = useState(() => {
    const stored = window.localStorage.getItem('chat_username');
    const preferred = account?.displayName?.trim?.();
    return (preferred || stored || 'Guest').trim() || 'Guest';
  });
  const [activeRoom, setActiveRoom] = useState(initialRoom || rooms[0] || 'general');
  const resolvedRoom = rooms.includes(activeRoom) ? activeRoom : rooms[0] || 'general';
  const members = roomMembers?.[resolvedRoom] || defaultMembers;
  const channelRooms = rooms.filter((value) => !String(value).startsWith('dm:'));
  const dmRooms = rooms.filter((value) => String(value).startsWith('dm:'));
  const communityMembers = Array.isArray(community?.members) ? community.members : [];
  const communityChannels = Array.isArray(community?.channels) ? community.channels : [];
  const isCommunityAdmin = Boolean(community?.isAdmin);
  const communityMembersByName = Object.fromEntries(
    communityMembers.map((member) => [member.displayName, member]),
  );
  const isAnnouncementChannel = (channel) => {
    const name = String(channel?.name || '').trim().toLowerCase();
    const slug = String(channel?.slug || '').trim().toLowerCase();
    return Boolean(channel?.adminOnlyPosting) || name === 'announcement' || name === 'announcements' || slug.endsWith('-announcement') || slug.endsWith('-announcements');
  };
  const activeCommunityChannel = communityChannels.find((channel) => channel.roomId === resolvedRoom) || null;
  const isAnnouncementRoom = isAnnouncementChannel(activeCommunityChannel);
  const canPostInResolvedRoom = !isAnnouncementRoom || isCommunityAdmin;
  const manageableChannels = communityChannels.filter((channel) => !isAnnouncementChannel(channel));
  const selectedManageableChannel =
    manageableChannels.find((channel) => channel.roomId === resolvedRoom) || null;
  const displayedMembers = (
    resolvedRoom.startsWith('dm:')
      ? members
      : members.length > 0
        ? members
        : communityMembers
  ).map((member) => {
    if (typeof member !== 'string') return member;
    return communityMembersByName[member] || { displayName: member, id: member, role: 'member', isSynthetic: true };
  });

  useEffect(() => {
    setChannelAccessDrafts(
      Object.fromEntries(
        communityChannels.map((channel) => [channel.id, Array.isArray(channel.memberIds) ? channel.memberIds : []]),
      ),
    );
  }, [communityChannels]);

  const appendMessage = (nextMessage) => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === nextMessage.id)) return prev;
      return [...prev, nextMessage];
    });
  };

  useEffect(() => {
    window.localStorage.setItem('chat_username', username);
  }, [username]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    activeRoomRef.current = resolvedRoom;
  }, [resolvedRoom]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const query = new URLSearchParams({
          room: resolvedRoom,
          ...(account?.clerkUserId ? { clerkUserId: account.clerkUserId } : {}),
        });
        const resp = await fetch(`/api/messages?${query.toString()}`);
        const data = await resp.json().catch(() => null);
        if (cancelled) return;
        if (!resp.ok || !data?.ok) {
          setHistoryWarning(data?.error ? `History: ${data.error}` : 'History: unavailable');
          return;
        }
        if (data.room && data.room !== activeRoomRef.current) return;
        setHistoryWarning('');

        setMessages(
          (Array.isArray(data.messages) ? data.messages : []).map((payload) =>
            normalizeMessage({
              ...payload,
              // Prefer stable sender ids from DB fetch for self/other styling.
              senderId: payload.senderId || payload.clerkUserId || payload.clientId,
            }),
          ),
        );
      } catch (error) {
        // Non-fatal: realtime still works.
        setHistoryWarning(`History: ${error?.message || 'unavailable'}`);
        console.warn('Failed to load chat history', error);
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [resolvedRoom]);

  useEffect(() => {
    let pusher;
    let channel;
    let onMessage;
    try {
      pusher = createPusherClient();
      channel = pusher.subscribe('chat');
      onMessage = (payload) => {
        if (!payload?.message || !payload?.username) return;
        if (payload.room && payload.room !== activeRoomRef.current) return;
        appendMessage(normalizeMessage(payload));
      };
      channel.bind('message', onMessage);
    } catch (error) {
      console.warn('Pusher client unavailable', error);
    }

    return () => {
      // Pusher JS unsubscribes via the client, not the channel instance.
      // Guarded so we don't throw during React strict-mode effect replays/HMR.
      try {
        if (channel && onMessage) channel.unbind('message', onMessage);
        if (pusher) pusher.unsubscribe('chat');
        if (pusher) pusher.disconnect();
      } catch (error) {
        console.warn('Pusher cleanup failed', error);
      }
    };
  }, []);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event) => {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    canvas.setPointerCapture?.(event.pointerId);
  };

  const draw = (event) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const stopDrawing = (event) => {
    isDrawingRef.current = false;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const downloadBoard = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'devrooms-whiteboard.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const sendMessage = () => {
    const trimmed = draftMessage.trim();
    if (!trimmed || !username || !canPostInResolvedRoom) return;
    setDraftMessage('');
    const optimistic = normalizeMessage({
      id: makeMessageId(),
      message: trimmed,
      username,
      time: new Date().toISOString(),
      room: resolvedRoom,
      clientId,
    });
    appendMessage(optimistic);
    fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: optimistic.id,
        message: trimmed,
        username,
        time: new Date().toISOString(),
        room: resolvedRoom,
        clientId,
        clerkUserId: account?.clerkUserId,
      }),
    })
      .then(async (resp) => {
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.ok) {
          console.warn('Message send failed', { status: resp.status, data });
          return;
        }
        if (data.dbStored === false) {
          const note = data.dbError ? `Storage: ${data.dbError}` : 'Storage: message not saved';
          setHistoryWarning(note);
          console.warn('Message was sent but NOT stored in MongoDB', data.dbError);
        } else {
          // Clear warning once we get a successful store.
          setHistoryWarning('');
        }
      })
      .catch((error) => {
        console.warn('Message send failed', error);
      });
  };

  const isCodeMessage = (text) => /^```[\w-]*\n[\s\S]*\n```$/.test(text.trim());

  const parseCodeMessage = (text) => {
    const match = text.trim().match(/^```([\w-]*)\n([\s\S]*)\n```$/);
    return {
      language: match?.[1] || 'text',
      code: match?.[2] || text,
    };
  };

  const parseMarkdownParts = (text) => {
    const input = String(text || '');
    const parts = [];
    const re = /```([\w-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(input)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', text: input.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1] || 'text', code: match[2] || '' });
      lastIndex = re.lastIndex;
    }
    if (lastIndex < input.length) {
      parts.push({ type: 'text', text: input.slice(lastIndex) });
    }
    return parts.length ? parts : [{ type: 'text', text: input }];
  };

  const renderInline = (text) => {
    const tokens = String(text || '').split(/`([^`]+)`/g);
    return tokens.map((token, idx) => {
      const isCode = idx % 2 === 1;
      if (!isCode) return token;
      return (
        <code key={`inline-${idx}`} className="discord-inline-code">
          {token}
        </code>
      );
    });
  };

  const renderTextBlock = (text, keyPrefix) => {
    const blocks = String(text || '')
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/g)
      .map((x) => x.trimEnd())
      .filter((x) => x.trim().length > 0);

    return blocks.map((block, idx) => {
      const lines = block.split('\n');
      const isUnorderedList = lines.length > 1 && lines.every((line) => /^\s*[-*]\s+/.test(line));
      const isOrderedList = lines.length > 1 && lines.every((line) => /^\s*\d+\.\s+/.test(line));

      if (isUnorderedList) {
        return (
          <ul key={`${keyPrefix}-ul-${idx}`} className="discord-md-list">
            {lines.map((line, lineIdx) => (
              <li key={`${keyPrefix}-uli-${idx}-${lineIdx}`}>{renderInline(line.replace(/^\s*[-*]\s+/, ''))}</li>
            ))}
          </ul>
        );
      }

      if (isOrderedList) {
        return (
          <ol key={`${keyPrefix}-ol-${idx}`} className="discord-md-list">
            {lines.map((line, lineIdx) => (
              <li key={`${keyPrefix}-oli-${idx}-${lineIdx}`}>{renderInline(line.replace(/^\s*\d+\.\s+/, ''))}</li>
            ))}
          </ol>
        );
      }

      return (
        <p key={`${keyPrefix}-p-${idx}`} className="discord-md-p">
          {renderInline(block)}
        </p>
      );
    });
  };

  const renderMessageContent = (text, keyPrefix) => {
    const trimmed = String(text || '').trim();
    if (isCodeMessage(trimmed)) {
      const parsed = parseCodeMessage(trimmed);
      return (
        <div className="discord-code-block">
          <SyntaxHighlighter language={parsed.language} style={oneDark}>
            {parsed.code}
          </SyntaxHighlighter>
        </div>
      );
    }

    const parts = parseMarkdownParts(trimmed);
    const nodes = [];
    parts.forEach((part, idx) => {
      if (part.type === 'code') {
        nodes.push(
          <div key={`${keyPrefix}-code-${idx}`} className="discord-code-block">
            <SyntaxHighlighter language={part.language || 'text'} style={oneDark}>
              {part.code}
            </SyntaxHighlighter>
          </div>,
        );
        return;
      }
      nodes.push(...renderTextBlock(part.text, `${keyPrefix}-t-${idx}`));
    });
    return nodes.length ? nodes : <p className="discord-md-p">{trimmed}</p>;
  };

  const mentionMember = (member) => {
    setDraftMessage((prev) => {
      const escaped = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|\\s)@${escaped}(\\s|$)`);
      if (pattern.test(prev)) return prev;
      return `${prev ? `${prev} ` : ''}@${member} `;
    });
    inputRef.current?.focus();
  };

  const toggleChannelMember = (channelId, memberId) => {
    setChannelAccessDrafts((prev) => {
      const current = new Set(prev[channelId] || []);
      if (current.has(memberId)) current.delete(memberId);
      else current.add(memberId);
      return { ...prev, [channelId]: Array.from(current) };
    });
  };

  const handleCreateChannel = async () => {
    const trimmed = newChannelName.trim();
    if (!trimmed) return;
      try {
        setAdminStatus('');
        setAdminStatusTone('info');
        await onCreateChannel?.({
        name: trimmed,
        memberIds: communityMembers.map((member) => member.id),
      });
      setNewChannelName('');
      setAdminStatus('Channel created.');
    } catch (error) {
      setAdminStatus(error?.message || 'Failed to create channel');
    }
  };

  const handleRemoveMember = async (memberId) => {
      try {
        setAdminStatus('');
        setAdminStatusTone('info');
        await onRemoveCommunityMember?.(memberId);
      setAdminStatus('Member removed.');
    } catch (error) {
      setAdminStatus(error?.message || 'Failed to remove member');
    }
  };

  const handleSaveChannelAccess = async (channelId) => {
      try {
        setAdminStatus('');
        setAdminStatusTone('info');
        await onUpdateChannelAccess?.(channelId, channelAccessDrafts[channelId] || []);
      setAdminStatus('Channel access updated.');
    } catch (error) {
      setAdminStatus(error?.message || 'Failed to update channel access');
    }
  };

  const handleDeleteChannel = async (channelId) => {
      try {
        setAdminStatus('');
        setAdminStatusTone('danger');
        setOpenChannelMenuId('');
        await onDeleteChannel?.(channelId);
        setAdminStatus('Channel deleted.');
      } catch (error) {
        setAdminStatusTone('danger');
        setAdminStatus(error?.message || 'Failed to delete channel');
      }
  };

  return (
    <section className="chat-layout discord-chatroom">
      <aside className="panel">
        <div className="panel-title">{community?.name ? `${community.name} Channels` : 'Channels'}</div>
        <ul className="channel-list">
          {channelRooms.map((room) => {
            const channel = communityChannels.find((item) => item.roomId === room) || null;
            const canDeleteChannel = Boolean(isCommunityAdmin && channel && !isAnnouncementChannel(channel));
            const isMenuOpen = openChannelMenuId === channel?.id;
            return (
              <li
                key={room}
                className={`channel-item ${resolvedRoom === room ? 'active' : ''}`}
                onClick={() => setActiveRoom(room)}
              >
                <span className="hash">#</span>
                <span className="channel-item-label">{roomLabels?.[room] || room}</span>
                {canDeleteChannel && (
                  <div className="channel-item-menu-wrap">
                    <button
                      type="button"
                      className="channel-item-menu-btn"
                      aria-label="Channel actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenChannelMenuId((current) => (current === channel.id ? '' : channel.id));
                      }}
                    >
                      <span />
                      <span />
                      <span />
                    </button>
                    {isMenuOpen && (
                      <button
                        type="button"
                        className="channel-item-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteChannel(channel.id);
                        }}
                      >
                        Delete channel
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {isCommunityAdmin && (
          <div className="community-sidebar-admin">
            <div className="community-sidebar-title">Create channel</div>
            <div className="community-admin-row community-admin-row-sidebar">
              <input
                type="text"
                placeholder="release-updates"
                value={newChannelName}
                onChange={(event) => setNewChannelName(event.target.value)}
              />
              <button type="button" onClick={handleCreateChannel}>
                Create
              </button>
            </div>
          </div>
        )}

        {dmRooms.length > 0 && (
          <>
            <div className="panel-title">Direct Messages</div>
            <ul className="channel-list">
              {dmRooms.map((room) => (
                <li
                  key={room}
                  className={`channel-item ${resolvedRoom === room ? 'active' : ''}`}
                  onClick={() => setActiveRoom(room)}
                >
                  <span className="hash">@</span>
                  {roomLabels?.[room] || room.slice(3, 9)}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <div className="panel chat-main">
        <div className="chat-header">
          <strong>
            {resolvedRoom.startsWith('dm:') ? `@ ${roomLabels?.[resolvedRoom] || resolvedRoom.slice(3, 9)}` : `# ${roomLabels?.[resolvedRoom] || resolvedRoom}`}
          </strong>
          <span>Messages</span>
          <button
            type="button"
            className="discord-header-btn"
            onClick={() => setIsWhiteboardOpen((prev) => !prev)}
          >
            {isWhiteboardOpen ? 'Close Whiteboard' : 'Whiteboard'}
          </button>
        </div>
        {historyWarning && <div className="chat-warning">{historyWarning}</div>}
        {isAnnouncementRoom && !isCommunityAdmin && (
          <div className="chat-warning">Only the community admin can post in announcement.</div>
        )}
        <div className="message-list" ref={messageListRef}>
          {messages.map((message) => {
            const normalizeUser = (value) => (value || '').trim().toLowerCase();
            const myIds = [clientId, account?.clerkUserId].filter(Boolean);
            const isSelfById = Boolean(message.senderId) && myIds.includes(message.senderId);
            const isSelfByName = normalizeUser(message.user) === normalizeUser(username);
            const isSelf = isSelfById || isSelfByName;
            return (
              <article
                key={message.id}
                className={`message-row ${message.isBot ? 'message-row-bot' : ''} ${isSelf ? 'message-row-self' : ''}`}
              >
                <div className="avatar">{(message.user || '?')[0]}</div>
                <div className="message-body">
                  <div className="message-meta">
                    <strong>{isSelf ? 'You' : message.user}</strong>
                    <span>{message.time}</span>
                  </div>
                  <div className="message-content">
                    {renderMessageContent(message.text, message.id)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {isWhiteboardOpen && (
          <div className="discord-whiteboard-wrap">
            <div className="discord-whiteboard-toolbar">
              <strong>Virtual Whiteboard</strong>
              <label>
                Color
                <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
              </label>
              <label>
                Brush
                <input
                  type="range"
                  min="1"
                  max="18"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                />
              </label>
              <button type="button" onClick={clearBoard}>Clear</button>
              <button type="button" onClick={downloadBoard}>Save</button>
            </div>
            <canvas
              ref={canvasRef}
              className="discord-whiteboard-canvas"
              width={900}
              height={260}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          </div>
        )}

      <form
          className="chat-input-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            ref={inputRef}
            placeholder={
              canPostInResolvedRoom
                ? `Message #${roomLabels?.[resolvedRoom] || resolvedRoom}`
                : 'Announcement is read-only for members'
            }
            value={draftMessage}
            disabled={!canPostInResolvedRoom}
            onChange={(e) => setDraftMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
        </form>
      </div>

      <aside className="panel members-panel">
        <div className="panel-title">{community?.name ? `${community.name} Members` : 'Members'}</div>
        <ul className="member-list">
          {displayedMembers.map((member) => {
            const item = typeof member === 'string' ? { displayName: member, id: member, role: 'member' } : member;
            return (
              <li key={item.id || item.displayName} onClick={() => mentionMember(item.displayName)}>
                <span className="status-dot" />
                <span className="community-member-name">
                  {item.displayName}
                  {item.role === 'owner' ? ' (Admin)' : ''}
                </span>
                {isCommunityAdmin && item.role !== 'owner' && item.displayName !== CODEX_AI_MEMBER && !item.isSynthetic && (
                  <button
                    type="button"
                    className="community-inline-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemoveMember(item.id);
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {isCommunityAdmin && (
          <div className="community-admin-panel">
            {selectedManageableChannel && (
              <div className="community-admin-block">
                <h4>Channel Access</h4>
                <div className="community-channel-access-list">
                  <div key={selectedManageableChannel.id} className="community-channel-access-card">
                    <strong>{selectedManageableChannel.name}</strong>
                    <div className="community-access-members">
                      {communityMembers.map((member) => (
                        <label key={`${selectedManageableChannel.id}-${member.id}`} className="community-access-toggle">
                          <input
                            type="checkbox"
                            checked={(channelAccessDrafts[selectedManageableChannel.id] || []).includes(member.id)}
                            onChange={() => toggleChannelMember(selectedManageableChannel.id, member.id)}
                          />
                          <span>{member.displayName}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="community-channel-save"
                      onClick={() => handleSaveChannelAccess(selectedManageableChannel.id)}
                    >
                      Save Access
                    </button>
                  </div>
                </div>
              </div>
            )}

            {adminStatus && <div className={`community-admin-status ${adminStatusTone === 'danger' ? 'danger' : ''}`}>{adminStatus}</div>}
          </div>
        )}
      </aside>
    </section>
  );
}
