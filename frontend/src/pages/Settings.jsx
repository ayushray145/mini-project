import { useEffect, useState } from 'react';

export default function Settings({ account, onAccountChange, onSaveAccount }) {
  const [draftAccount, setDraftAccount] = useState(account);
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    setDraftAccount(account);
  }, [account]);

  const setAccountField = (key, value) => {
    setDraftAccount((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaveState({ status: 'saving', message: 'Saving...' });
      const nextAccount = await onSaveAccount?.(draftAccount);
      if (nextAccount) onAccountChange?.(nextAccount);
      setSaveState({ status: 'success', message: 'Changes saved.' });
    } catch (error) {
      setSaveState({ status: 'error', message: error?.message || 'Failed to save settings' });
    }
  };

  return (
    <section className="settings-layout">
      <article className="settings-card">
        <h1>Workspace Settings</h1>
        <p>DevRooms now uses one shared interface theme based on the landing page.</p>

        <div className="settings-section">
          <h2>User / Account (Frontend Only)</h2>

          <label className="neo-theme-select-wrap settings-select">
            <span>Display Name</span>
            <input
              className="neo-theme-select"
              type="text"
              value={draftAccount.displayName}
              onChange={(e) => setAccountField('displayName', e.target.value)}
              placeholder="Your name"
            />
          </label>

          <label className="neo-theme-select-wrap settings-select">
            <span>Email</span>
            <input
              className="neo-theme-select"
              type="text"
              value={draftAccount.email}
              readOnly
              placeholder="name@company.com"
            />
          </label>

          <label className="neo-theme-select-wrap settings-select">
            <span>Role</span>
            <select
              className="neo-theme-select"
              value={draftAccount.role}
              onChange={(e) => setAccountField('role', e.target.value)}
            >
              <option>Developer</option>
              <option>Designer</option>
              <option>Product Manager</option>
              <option>QA Engineer</option>
              <option>DevOps Engineer</option>
            </select>
          </label>

          <label className="neo-theme-select-wrap settings-select">
            <span>Status Message</span>
            <input
              className="neo-theme-select"
              type="text"
              value={draftAccount.statusMessage}
              onChange={(e) => setAccountField('statusMessage', e.target.value)}
              placeholder="Working on sprint backlog"
            />
          </label>

          <div className="settings-actions">
            <button
              type="button"
              className="settings-save-button"
              onClick={handleSave}
              disabled={saveState.status === 'saving'}
            >
              {saveState.status === 'saving' ? 'Saving...' : 'Save Changes'}
            </button>
            {saveState.message && (
              <span className={`settings-save-status ${saveState.status === 'error' ? 'error' : ''}`}>
                {saveState.message}
              </span>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
