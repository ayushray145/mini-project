import { useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { createPusherClient } from '../lib/pusher';

const defaultRooms = ['general', 'backend', 'frontend', 'devops'];
const defaultMembers = ['Ava', 'Noah', 'Mia (AI)', 'Liam', 'Sofia', 'Ethan'];

export default function ChatRoom({ onGoHome, account, rooms = defaultRooms, roomLabels = {}, roomMembers, initialRoom }) {
  const canvasRef = useRef(null);
  const messageListRef = useRef(null);
  const inputRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const activeRoomRef = useRef('general');
  const clientIdRef = useRef('');
  const [brushColor, setBrushColor] = useState('#111111');
  const [brushSize, setBrushSize] = useState(4);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [historyWarning, setHistoryWarning] = useState('');
  const [username, setUsername] = useState('');
  const [activeRoom, setActiveRoom] = useState(initialRoom || rooms[0] || 'general');
  const members = roomMembers?.[activeRoom] || defaultMembers;
  const channelRooms = rooms.filter((value) => !String(value).startsWith('dm:'));
  const dmRooms = rooms.filter((value) => String(value).startsWith('dm:'));

  const appendMessage = (nextMessage) => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === nextMessage.id)) return prev;
      return [...prev, nextMessage];
    });
  };

  useEffect(() => {
    const storedId = window.localStorage.getItem('chat_client_id');
    const generated =
      storedId ||
      `c-${
        window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      }`;
    clientIdRef.current = generated;
    window.localStorage.setItem('chat_client_id', generated);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('chat_username');
    const preferred = account?.displayName?.trim?.();
    const input = preferred || stored || window.prompt('Enter your username') || '';
    const finalName = input.trim() || `Guest-${Math.random().toString(36).slice(2, 6)}`;
    setUsername(finalName);
    window.localStorage.setItem('chat_username', finalName);
  }, [account?.displayName]);

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
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const resp = await fetch(`/api/messages?room=${encodeURIComponent(activeRoom)}`);
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
  }, [activeRoom]);

  useEffect(() => {
    if (!rooms.includes(activeRoom)) {
      const nextRoom = rooms[0] || 'general';
      setActiveRoom(nextRoom);
      activeRoomRef.current = nextRoom;
    }
  }, [rooms, activeRoom]);

  useEffect(() => {
    if (initialRoom && rooms.includes(initialRoom)) {
      setActiveRoom(initialRoom);
    }
  }, [initialRoom, rooms]);

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

  const normalizeMessage = (payload) => ({
    id: payload.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user: payload.username,
    senderId: payload.senderId || payload.clerkUserId || payload.clientId || '',
    time: payload.time
      ? new Date(payload.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : getCurrentTime(),
    text: payload.message || payload.text || '',
    isBot: payload.isBot,
  });

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

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const sendMessage = () => {
    const trimmed = draftMessage.trim();
    if (!trimmed || !username) return;
    setDraftMessage('');
    const optimistic = normalizeMessage({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message: trimmed,
      username,
      time: new Date().toISOString(),
      room: activeRoom,
      clientId: clientIdRef.current,
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
        room: activeRoom,
        clientId: clientIdRef.current,
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

  const mentionMember = (member) => {
    setDraftMessage((prev) => {
      const escaped = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|\\s)@${escaped}(\\s|$)`);
      if (pattern.test(prev)) return prev;
      return `${prev ? `${prev} ` : ''}@${member} `;
    });
    inputRef.current?.focus();
  };

  return (
    <section className="chat-layout discord-chatroom">
      <aside className="panel">
        <div className="panel-title">Channels</div>
        <ul className="channel-list">
          {channelRooms.map((room) => (
            <li
              key={room}
              className={`channel-item ${activeRoom === room ? 'active' : ''}`}
              onClick={() => setActiveRoom(room)}
            >
              <span className="hash">#</span>
              {room}
            </li>
          ))}
        </ul>

        {dmRooms.length > 0 && (
          <>
            <div className="panel-title">Direct Messages</div>
            <ul className="channel-list">
              {dmRooms.map((room) => (
                <li
                  key={room}
                  className={`channel-item ${activeRoom === room ? 'active' : ''}`}
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
            {activeRoom.startsWith('dm:') ? `@ ${roomLabels?.[activeRoom] || activeRoom.slice(3, 9)}` : `# ${activeRoom}`}
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
        <div className="message-list" ref={messageListRef}>
          {messages.map((message) => {
            const normalizeUser = (value) => (value || '').trim().toLowerCase();
            const myIds = [clientIdRef.current, account?.clerkUserId].filter(Boolean);
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
                    {isCodeMessage(message.text) ? (
                      <div className="discord-code-block">
                        <SyntaxHighlighter language={parseCodeMessage(message.text).language} style={oneDark}>
                          {parseCodeMessage(message.text).code}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <p>{message.text}</p>
                    )}
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
            placeholder={`Message #${activeRoom}`}
            value={draftMessage}
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
        <div className="panel-title">Members</div>
        <ul className="member-list">
          {members.map((member) => (
            <li key={member} onClick={() => mentionMember(member)}>
              <span className="status-dot" />
              {member}
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
