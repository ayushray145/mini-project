import { useState } from 'react';

export default function CommunityModal({
  isOpen,
  mode = 'create',
  onClose,
  onModeChange,
  onCreateCommunity,
  onJoinCommunity,
}) {
  const [communityName, setCommunityName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmed = communityName.trim();
    if (!trimmed) {
      setError('Enter a community name.');
      return;
    }
    setError('');
    try {
      await onCreateCommunity?.({ name: trimmed, members: [] });
      setCommunityName('');
    } catch (nextError) {
      setError(nextError?.message || 'Failed to create community');
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Enter an invite code.');
      return;
    }
    setError('');
    try {
      await onJoinCommunity?.(inviteCode.trim());
      setInviteCode('');
    } catch (nextError) {
      setError(nextError?.message || 'Failed to join community');
    }
  };

  return (
    <div
      className="community-modal-backdrop"
      onClick={() => {
        setError('');
        onClose?.();
      }}
    >
      <div
        className="community-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="community-modal-top">
          <div>
            <span className="community-modal-kicker">Quick action</span>
            <h2 id="community-modal-title">
              {mode === 'create' ? 'Create a community' : 'Join a community'}
            </h2>
          </div>
          <button
            type="button"
            className="community-modal-close"
            onClick={() => {
              setError('');
              onClose?.();
            }}
          >
            Close
          </button>
        </div>

        <div className="community-modal-switcher">
          <button
            type="button"
            className={mode === 'create' ? 'active' : ''}
            onClick={() => {
              setError('');
              onModeChange?.('create');
            }}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'active' : ''}
            onClick={() => {
              setError('');
              onModeChange?.('join');
            }}
          >
            Join
          </button>
        </div>

        {mode === 'create' ? (
          <div className="community-modal-form">
            <label className="community-modal-field">
              <span>Community name</span>
              <input
                type="text"
                placeholder="e.g. code-review-circle"
                value={communityName}
                onChange={(event) => setCommunityName(event.target.value)}
              />
            </label>
            <button type="button" className="neo-btn neo-btn-yellow" onClick={handleCreate}>
              Create Community
            </button>
          </div>
        ) : (
          <div className="community-modal-form">
            <label className="community-modal-field">
              <span>Invite code</span>
              <input
                type="text"
                placeholder="DEVR-8K29XQ"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              />
            </label>
            <p className="community-modal-note">
              Ask the community owner for the unique invite code, then use it
              here to join the workspace.
            </p>
            <button type="button" className="neo-btn neo-btn-purple" onClick={handleJoin}>
              Join Community
            </button>
          </div>
        )}

        {error && <div className="community-modal-error">{error}</div>}
      </div>
    </div>
  );
}
