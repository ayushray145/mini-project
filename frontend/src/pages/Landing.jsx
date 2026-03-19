export default function Landing({
  onEnterDashboard,
  onEnterChat,
  onLogin,
  onSignup,
  themeVars,
}) {
  return (
    <section className="neo-landing" style={{ ...themeVars, '--neo-bg': '#000000' }}>
      <header className="neo-nav">
        <button
          type="button"
          className="neo-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <span className="neo-logo-mark" aria-hidden="true">#</span>
          <span>DevRooms</span>
        </button>
        <nav className="neo-nav-links">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#metrics">Metrics</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="neo-nav-actions">
          <button className="neo-btn neo-btn-yellow" onClick={onLogin}>Login</button>
          <button className="neo-btn neo-btn-dark" onClick={onSignup}>Signup</button>
        </div>
      </header>

      <div className="neo-hero">
        <div className="neo-copy">
          <h1>
            <span className="neo-title-top">&lt;Developer&gt;</span>
            <br />
            <span className="neo-title-bottom">Chatroom</span>
          </h1>
          <p className="neo-subhead">Ship decisions as fast as code.</p>
          <div className="neo-actions">
            <button className="neo-btn neo-btn-yellow" onClick={onEnterDashboard}>Enter Dashboard</button>
            <button className="neo-btn neo-btn-purple" onClick={onEnterChat}>Join Chat Room</button>
          </div>
        </div>
        <aside className="neo-hero-visual" aria-label="Platform preview">
          <div className="neo-collab-card">
            <div className="neo-collab-top">
              <strong>Live Code Review Room</strong>
              <span>4 developers online</span>
            </div>
            <div className="neo-collab-screens">
              <article className="neo-dev-screen">
                <header>Ava · frontend</header>
                <code>{`const message = formatSnippet(input);`}</code>
                <code>{`sendToRoom("frontend", message);`}</code>
              </article>
              <article className="neo-dev-screen">
                <header>Noah · backend</header>
                <code>{`router.post("/review", validatePR);`}</code>
                <code>{`return res.json({ ok: true });`}</code>
              </article>
            </div>
            <div className="neo-review-status">
              <div className="neo-review-status-top">
                <strong>Code reviewed: Correct</strong>
                <span>96% confidence</span>
              </div>
              <div className="neo-review-bar">
                <span />
              </div>
              <p>AI + peer review checks passed with secure and production-ready suggestions.</p>
            </div>
          </div>
        </aside>
      </div>

      <section id="features" className="neo-features">
        <article className="neo-feature-card">
          <h3>Channel-First Communication</h3>
          <p>Organize every squad into purpose-built rooms with focused context and clean handoffs.</p>
        </article>
        <article className="neo-feature-card">
          <h3>Integrated AI Assistant</h3>
          <p>Generate release notes, summarize standups, and unblock engineers directly in chat.</p>
        </article>
        <article className="neo-feature-card">
          <h3>Live Delivery Visibility</h3>
          <p>Track deployments, QA status, and incidents with updates streamed in real time.</p>
        </article>
      </section>

      <section id="workflow" className="neo-process">
        <h2>How Teams Use DevRooms</h2>
        <div className="neo-process-grid">
          <div className="neo-step">
            <span>01</span>
            <h4>Create Rooms</h4>
            <p>Spin up chat channels for sprint goals, incidents, and release windows.</p>
          </div>
          <div className="neo-step">
            <span>02</span>
            <h4>Ship Together</h4>
            <p>Collaborate with engineering, product, and QA in one synchronized workspace.</p>
          </div>
          <div className="neo-step">
            <span>03</span>
            <h4>Review Fast</h4>
            <p>Use AI summaries and activity feeds to decide quickly and move forward.</p>
          </div>
        </div>
      </section>

      <section id="metrics" className="neo-metrics">
        <div>
          <strong>250+</strong>
          <span>Active engineering teams</span>
        </div>
        <div>
          <strong>1.2M</strong>
          <span>Messages processed weekly</span>
        </div>
        <div>
          <strong>99.95%</strong>
          <span>Platform reliability target</span>
        </div>
      </section>

      <section className="neo-cta-band">
        <h2>Ready to run your team like a high-speed command center?</h2>
        <div className="neo-actions">
          <button className="neo-btn neo-btn-purple" onClick={onEnterDashboard}>Launch Workspace</button>
          <button className="neo-btn neo-btn-yellow" onClick={onEnterChat}>Explore Live Chat</button>
        </div>
      </section>

      <footer id="contact" className="neo-footer">
        <div className="neo-footer-brand">DevRooms</div>
        <div className="neo-footer-links">
          <a href="#">Product</a>
          <a href="#">Security</a>
          <a href="#">Docs</a>
          <a href="#">Support</a>
        </div>
        <p>© 2026 DevRooms, Inc. Built for modern engineering teams.</p>
      </footer>
    </section>
  );
}
