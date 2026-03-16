import { useMemo, useState } from 'react';

const defaultContacts = ['Ayush', 'Ashwin', 'Ghosh (AI)', 'Amritanshu', 'Aditya', 'Santanu'];

export default function ChatHub({ onJoinExisting, onCreateRoom, contacts = defaultContacts }) {
  const [mode, setMode] = useState('select');
  const [roomName, setRoomName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState(() => new Set());
  const [error, setError] = useState('');

  const sortedContacts = useMemo(() => [...contacts].sort(), [contacts]);

  const toggleContact = (contact) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contact)) {
        next.delete(contact);
      } else {
        next.add(contact);
      }
      return next;
    });
  };

  const handleCreate = () => {
    const trimmed = roomName.trim();
    if (!trimmed) {
      setError('Please name the chatroom.');
      return;
    }
    if (selectedContacts.size === 0) {
      setError('Select at least one contact to include.');
      return;
    }
    setError('');
    onCreateRoom(trimmed, Array.from(selectedContacts));
  };

  return (
    <section className={`chat-hub ${mode === 'create' ? 'chat-hub-create' : ''}`}>
      <header className="chat-hub-header">
        <h1>Chatrooms</h1>
        <p className="muted">Pick an existing room or spin up a new one.</p>
      </header>

      {mode === 'select' && (
        <div className="chat-hub-actions">
          <button type="button" className="neo-btn neo-btn-yellow" onClick={onJoinExisting}>
            Join Existing Rooms
          </button>
          <button type="button" className="neo-btn neo-btn-purple" onClick={() => setMode('create')}>
            Create a New Room
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="chat-hub-form">
          <div className="chat-hub-field">
            <label htmlFor="chatroom-name">Chatroom name</label>
            <input
              id="chatroom-name"
              type="text"
              placeholder="e.g. release-planning"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
          </div>

          <div className="chat-hub-field">
            <label>Select contacts</label>
            <div className="chat-hub-contacts">
              {sortedContacts.map((contact) => (
                <button
                  key={contact}
                  type="button"
                  className={`chat-hub-chip ${selectedContacts.has(contact) ? 'active' : ''}`}
                  onClick={() => toggleContact(contact)}
                >
                  {contact}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="chat-hub-error">{error}</div>}

          <div className="chat-hub-actions">
            <button type="button" className="neo-btn neo-btn-light" onClick={() => setMode('select')}>
              Back
            </button>
            <button type="button" className="neo-btn neo-btn-green" onClick={handleCreate}>
              Create Room
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
