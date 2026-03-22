const communityHighlights = [
  'Deployment boards synced with release rooms',
  'Code review circles with shared snippets',
  'Company-facing hubs for handoff and support',
];

export default function CommunityHome({
  onOpenCommunityModal,
}) {
  return (
    <section className="community-home">
      <div className="community-home-grid">
        <div className="community-hero-copy">
          <span className="community-kicker">Logged-in workspace</span>
          <h1>
            Explore
            <em> developer communities</em>
          </h1>
          <div className="community-hero-actions">
            <button
              type="button"
              className="neo-btn neo-btn-yellow"
              onClick={() => onOpenCommunityModal?.('create')}
            >
              Create Community
            </button>
            <button
              type="button"
              className="neo-btn neo-btn-purple"
              onClick={() => onOpenCommunityModal?.('join')}
            >
              Join Community
            </button>
          </div>

          <div className="community-highlight-list">
            {communityHighlights.map((item) => (
              <div key={item} className="community-highlight-item">
                <span className="community-highlight-dot" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="community-hero-visual" aria-hidden="true">
          <div className="community-track" />
          <div className="community-graphic community-graphic-main">
            <div className="community-screen community-screen-top">
              <span className="community-chip">Deploy</span>
              <span className="community-chip community-chip-muted">Review</span>
            </div>
            <div className="community-screen community-screen-center">
              <div className="community-screen-window">
                <div className="community-window-line community-window-line-wide" />
                <div className="community-window-line" />
                <div className="community-window-line community-window-line-short" />
              </div>
              <div className="community-screen-node">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M8.5 12.5L13.8 7.2a3 3 0 1 1 4.2 4.2l-7.1 7.1a5 5 0 1 1-7.1-7.1l7.8-7.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div className="community-screen community-screen-bottom">
              <div className="community-avatar-stack">
                <span>AR</span>
                <span>NR</span>
                <span>QA</span>
              </div>
              <div className="community-review-pill">Code Share</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
