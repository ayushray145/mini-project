export default function Settings({ account, onAccountChange }) {
  const setAccountField = (key, value) => {
    const next = { ...account, [key]: value };
    onAccountChange(next);
    localStorage.setItem('devrooms.account', JSON.stringify(next));
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
              value={account.displayName}
              onChange={(e) => setAccountField('displayName', e.target.value)}
              placeholder="Your name"
            />
          </label>

          <label className="neo-theme-select-wrap settings-select">
            <span>Email</span>
            <input
              className="neo-theme-select"
              type="text"
              value={account.email}
              onChange={(e) => setAccountField('email', e.target.value)}
              placeholder="name@company.com"
            />
          </label>

          <label className="neo-theme-select-wrap settings-select">
            <span>Role</span>
            <select
              className="neo-theme-select"
              value={account.role}
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
              value={account.statusMessage}
              onChange={(e) => setAccountField('statusMessage', e.target.value)}
              placeholder="Working on sprint backlog"
            />
          </label>
        </div>
      </article>
    </section>
  );
}
