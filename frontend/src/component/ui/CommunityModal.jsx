import { useEffect, useMemo, useState } from 'react';

export default function CommunityModal({
  isOpen,
  mode = 'create',
  onClose,
  onModeChange,
  communities = [],
  onCreateCommunity,
  onJoinCommunity,
}) {
  const [communityName, setCommunityName] = useState('');
  const [invitees, setInvitees] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [error, setError] = useState('');

  const communityOptions = useMemo(
    () => communities.filter((community) => !String(community.id).startsWith('dm:')),
    [communities],
  );

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (mode === 'join') {
      setSelectedCommunity((prev) => prev || communityOptions[0]?.id || '');
    }
  }, [isOpen, mode, communityOptions]);

  if (!isOpen) return null;

  const handleCreate = () => {
    const trimmed = communityName.trim();
    if (!trimmed) {
      setError('Enter a community name.');
      return;
    }
    const members = invitees
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setError('');
    onCreateCommunity?.({ name: trimmed, members });
    setCommunityName('');
    setInvitees('');
  };

  const handleJoin = () => {
    if (!selectedCommunity) {
      setError('Choose a community to join.');
      return;
    }
    setError('');
    onJoinCommunity?.(selectedCommunity);
  };

  return (
    <div className="community-modal-backdrop" onClick={onClose}>
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
          <button type="button" className="community-modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="community-modal-switcher">
          <button
            type="button"
            className={mode === 'create' ? 'active' : ''}
            onClick={() => onModeChange?.('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'active' : ''}
            onClick={() => onModeChange?.('join')}
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
            <label className="community-modal-field">
              <span>Invite teammates</span>
              <input
                type="text"
                placeholder="Ava, Noah, Priya"
                value={invitees}
                onChange={(event) => setInvitees(event.target.value)}
              />
            </label>
            <p className="community-modal-note">
              Use communities to connect with companies, organise your workflow,
              and review and share your code.
            </p>
            <button type="button" className="neo-btn neo-btn-yellow" onClick={handleCreate}>
              Create Community
            </button>
          </div>
        ) : (
          <div className="community-modal-form">
            <label className="community-modal-field">
              <span>Select a community</span>
              <select
                value={selectedCommunity}
                onChange={(event) => setSelectedCommunity(event.target.value)}
              >
                <option value="">Choose a community</option>
                {communityOptions.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="community-modal-community-list">
              {communityOptions.slice(0, 4).map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className={`community-modal-community-card ${
                    selectedCommunity === community.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedCommunity(community.id)}
                >
                  <strong>{community.label}</strong>
                  <span>{community.members} members online</span>
                </button>
              ))}
            </div>
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
