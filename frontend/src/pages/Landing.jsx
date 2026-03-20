import { useState, useEffect, useRef } from "react";

function MetricCounter({ end, suffix, decimals = 0 }) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);
  const spanRef = useRef(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          const duration = 1400;
          const startTime = performance.now();
          const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(eased * end);
            if (progress < 1) {
              rafRef.current = requestAnimationFrame(animate);
            }
          };
          rafRef.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end]);

  const display = decimals > 0 ? count.toFixed(decimals) : Math.floor(count);
  return (
    <span ref={spanRef}>
      {display}
      {suffix}
    </span>
  );
}

export default function Landing({
  onEnterDashboard,
  onEnterChat,
  onLogin,
  onSignup,
  themeVars,
}) {
  return (
    <section
      className="neo-landing"
      style={{ ...themeVars, "--neo-bg": "#000000" }}
    >
      <header className="neo-nav">
        <button
          type="button"
          className="neo-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <span className="neo-logo-mark" aria-hidden="true">
            #
          </span>
          <span>DevRooms</span>
        </button>
        <nav className="neo-nav-links">
          <a href="#features">Features</a>

          <a href="#metrics">Metrics</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="neo-nav-actions">
          <button className="neo-btn neo-btn-yellow" onClick={onLogin}>
            Login
          </button>
          <button className="neo-btn neo-btn-dark" onClick={onSignup}>
            Signup
          </button>
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
            <button
              className="neo-btn neo-btn-yellow"
              onClick={onEnterDashboard}
            >
              Enter Dashboard
            </button>
            <button className="neo-btn neo-btn-purple" onClick={onEnterChat}>
              Join Chat Room
            </button>
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
              <p>
                AI + peer review checks passed with secure and production-ready
                suggestions.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section id="features" className="nf-section">
        <style>{`
          .nf-section {
            width: calc(100% + 56px);
            margin-left: -28px;
            margin-right: -28px;
            background: transparent;
            padding: 0 0 80px;
            position: relative;
            z-index: 1;
          }
          .nf-label {
            text-align: center;
            padding: 18px 0 40px;
            margin-top: 100px;
          }
          .nf-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            width: 100%;
            max-width: 1160px;
            margin: 0 auto;
            padding: 0 40px;
            box-sizing: border-box;
          }
          .nf-card {
            border-radius: 20px;
            overflow: hidden;
            background: #111318;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
          }
          .nf-card:hover {
            transform: translateY(-7px);
            box-shadow: 0 28px 70px rgba(0, 0, 0, 0.65);
          }
          .nf-visual {
            height: 250px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 20px;
          }
          .nf-visual-blue    { background: linear-gradient(145deg, #0c1929 0%, #0f2035 60%, #0a1a2e 100%); }
          .nf-visual-purple  { background: linear-gradient(145deg, #13102a 0%, #181438 60%, #100e24 100%); }
          .nf-visual-pink    { background: linear-gradient(145deg, #1e0f18 0%, #261422 60%, #1a0e16 100%); }
          .nf-body {
            padding: 22px 24px 28px;
            position: relative;
            z-index: 2;
          }

          /* ── Card 1: Channel mockup ── */
          .nf-ch-mock {
            background: #fff;
            border-radius: 14px;
            overflow: hidden;
            width: 198px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
          }
          .nf-ch-titlebar {
            background: #f3f4f6;
            padding: 9px 12px;
            display: flex;
            align-items: center;
            gap: 7px;
            border-bottom: 1px solid #e5e7eb;
          }
          .nf-ch-dots { display: flex; gap: 5px; }
          .nf-ch-dot  { width: 9px; height: 9px; border-radius: 50%; }
          .nf-ch-wintitle { font-size: 11px; font-weight: 600; color: #374151; margin-left: 4px; }
          .nf-ch-section { padding: 10px 12px 14px; }
          .nf-ch-section-label {
            font-size: 9px;
            font-weight: 700;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 7px;
          }
          .nf-ch-row {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 3px 5px;
            border-radius: 6px;
            margin-bottom: 2px;
          }
          .nf-ch-row.active { background: #eff6ff; }
          .nf-ch-chk {
            width: 14px; height: 14px;
            border-radius: 50%;
            background: #22c55e;
            display: flex; align-items: center; justify-content: center;
            font-size: 8px; color: #fff;
            flex-shrink: 0; font-style: normal;
          }
          .nf-ch-chk.ghost { background: #e5e7eb; }
          .nf-ch-hash { font-size: 11px; color: #9ca3af; font-weight: 700; }
          .nf-ch-name { font-size: 11px; color: #374151; flex: 1; }
          .nf-ch-row.active .nf-ch-name { color: #1d4ed8; font-weight: 600; }
          .nf-ch-bar { height: 6px; border-radius: 100px; background: #e5e7eb; margin: 8px 0 3px; }
          .nf-ch-bar.s { width: 55%; background: #d1d5db; }

          /* ── Card 2: AI integrations ── */
          .nf-ai-scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
          }
          .nf-ai-hub {
            background: #fff;
            border-radius: 12px;
            padding: 9px 18px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
          }
          .nf-ai-hub-icon  { font-size: 20px; }
          .nf-ai-hub-name  { font-size: 13px; font-weight: 700; color: #111; line-height: 1.2; }
          .nf-ai-hub-status{ font-size: 10px; color: #22c55e; font-weight: 600; }
          .nf-ai-logos {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 7px;
            width: 100%;
          }
          .nf-ai-chip {
            background: #fff;
            border-radius: 9px;
            padding: 6px 8px;
            font-size: 10px;
            font-weight: 600;
            color: #374151;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.10);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          }

          /* ── Card 3: Deployment tree ── */
          .nf-dv-scene {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            width: 100%;
          }
          .nf-dv-topcard {
            background: #fff;
            border-radius: 12px;
            padding: 8px 18px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
          }
          .nf-dv-topname { font-size: 13px; font-weight: 700; color: #111; }
          .nf-dv-vline {
            width: 2px; height: 16px;
            background: rgba(0, 0, 0, 0.18);
            border-radius: 2px;
          }
          .nf-dv-avatars {
            display: flex;
            gap: 8px;
            position: relative;
          }
          .nf-dv-avatars::before {
            content: '';
            position: absolute;
            top: 50%; left: -6px; right: -6px;
            height: 2px;
            background: rgba(0, 0, 0, 0.14);
            transform: translateY(-50%);
            z-index: 0;
          }
          .nf-dv-av {
            width: 42px; height: 42px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 700; color: #fff;
            box-shadow: 0 3px 14px rgba(0, 0, 0, 0.22);
            border: 3px solid #fff;
            position: relative; z-index: 1;
          }
          .nf-dv-status {
            background: #fff;
            border-radius: 12px;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
            font-size: 12px; font-weight: 700; color: #111;
          }
          .nf-dv-dot {
            width: 10px; height: 10px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.28);
            flex-shrink: 0;
          }

          /* ── Responsive ── */
          @media (max-width: 900px) {
            .nf-grid { grid-template-columns: 1fr; max-width: 480px; }
          }
          @media (max-width: 640px) {
            .nf-section { padding: 0 0 60px; }
            .nf-grid    { padding: 0 20px; }
          }
        `}</style>

        <div className="nf-label">
          <h2
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)",
              fontWeight: 800,
              color: "#ffffff",
              margin: "10px 0 0",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              display: "block",
            }}
          >
            Features
          </h2>
        </div>

        <div className="nf-grid">
          {/* ── Card 1: Channel-First Communication ── */}
          <article className="nf-card">
            <div className="nf-visual nf-visual-blue">
              <div className="nf-ch-mock">
                <div className="nf-ch-titlebar">
                  <div className="nf-ch-dots">
                    <div
                      className="nf-ch-dot"
                      style={{ background: "#ff5f57" }}
                    />
                    <div
                      className="nf-ch-dot"
                      style={{ background: "#febc2e" }}
                    />
                    <div
                      className="nf-ch-dot"
                      style={{ background: "#28c840" }}
                    />
                  </div>
                  <span className="nf-ch-wintitle">DevRooms</span>
                </div>
                <div className="nf-ch-section">
                  <div className="nf-ch-section-label">Channels</div>
                  {[
                    { name: "general", active: true },
                    { name: "backend", active: true },
                    { name: "frontend", active: false },
                    { name: "devops", active: false },
                  ].map(({ name, active }) => (
                    <div
                      key={name}
                      className={`nf-ch-row${active ? " active" : ""}`}
                    >
                      <i className={`nf-ch-chk${active ? "" : " ghost"}`}>
                        {active ? "✓" : ""}
                      </i>
                      <span className="nf-ch-hash">#</span>
                      <span className="nf-ch-name">{name}</span>
                    </div>
                  ))}
                  <div className="nf-ch-bar" />
                  <div className="nf-ch-bar s" />
                </div>
              </div>
            </div>
            <div className="nf-body">
              <h3
                style={{
                  color: "#ffffff",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  margin: "0 0 10px",
                  letterSpacing: "-0.01em",
                }}
              >
                Channel-First Communication
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Organize every squad into purpose-built rooms with focused
                context and clean handoffs.
              </p>
            </div>
          </article>

          {/* ── Card 2: Integrated AI Assistant ── */}
          <article className="nf-card">
            <div className="nf-visual nf-visual-purple">
              <div className="nf-ai-scene">
                <div className="nf-ai-hub">
                  <span className="nf-ai-hub-icon">🤖</span>
                  <div>
                    <div className="nf-ai-hub-name">Mia AI</div>
                    <div className="nf-ai-hub-status">● Active</div>
                  </div>
                </div>
                <div className="nf-ai-logos">
                  {[
                    { icon: "⚡", name: "Pusher" },
                    { icon: "🍃", name: "MongoDB" },
                    { icon: "🔐", name: "Clerk" },
                    { icon: "✨", name: "Gemini" },
                    { icon: "🐙", name: "GitHub" },
                    { icon: "▲", name: "Vercel" },
                  ].map(({ icon, name }) => (
                    <div key={name} className="nf-ai-chip">
                      <span>{icon}</span>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="nf-body">
              <h3
                style={{
                  color: "#ffffff",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  margin: "0 0 10px",
                  letterSpacing: "-0.01em",
                }}
              >
                Integrated AI Assistant
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Generate release notes, summarize standups, and unblock
                engineers directly in chat.
              </p>
            </div>
          </article>

          {/* ── Card 3: Live Delivery Visibility ── */}
          <article className="nf-card">
            <div className="nf-visual nf-visual-pink">
              <div className="nf-dv-scene">
                <div className="nf-dv-topcard">
                  <span style={{ fontSize: 16 }}>🚀</span>
                  <span className="nf-dv-topname">DevRooms</span>
                </div>
                <div className="nf-dv-vline" />
                <div className="nf-dv-avatars">
                  {[
                    { initials: "AV", bg: "#6366f1" },
                    { initials: "NH", bg: "#f59e0b" },
                    { initials: "SO", bg: "#ec4899" },
                  ].map(({ initials, bg }) => (
                    <div
                      key={initials}
                      className="nf-dv-av"
                      style={{ background: bg }}
                    >
                      {initials}
                    </div>
                  ))}
                </div>
                <div className="nf-dv-vline" />
                <div className="nf-dv-status">
                  <div className="nf-dv-dot" />
                  <span>Deploy Live</span>
                </div>
              </div>
            </div>
            <div className="nf-body">
              <h3
                style={{
                  color: "#ffffff",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  margin: "0 0 10px",
                  letterSpacing: "-0.01em",
                }}
              >
                Live Delivery Visibility
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Track deployments, QA status, and incidents with updates
                streamed in real time.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section id="metrics" className="neo-metrics nm-metrics">
        <style>{`
          .nm-metrics {
            display: block !important;
            max-width: 1160px !important;
            margin: 80px auto 0 !important;
            padding: 0 40px !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .nm-cols {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            border-radius: 0 !important;
            border-top: 1px solid rgba(255,255,255,0.07) !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
          .nm-col {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            border-radius: 0 !important;
            padding: 48px 24px !important;
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
          }
          .nm-col:not(:last-child) {
            border-right: 1px solid rgba(255,255,255,0.07) !important;
          }
          .nm-col:hover {
            transform: none !important;
            box-shadow: none !important;
          }
          .nm-col-number {
            font-size: clamp(2.4rem, 4.5vw, 3.6rem);
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.04em;
            line-height: 1;
            display: block;
          }
          .nm-col-label {
            font-size: 0.82rem;
            color: #475569;
            font-weight: 400;
            line-height: 1.5;
            max-width: 160px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          @media (max-width: 700px) {
            .nm-cols { grid-template-columns: 1fr !important; }
            .nm-col:not(:last-child) {
              border-right: none !important;
              border-bottom: 1px solid rgba(255,255,255,0.07) !important;
            }
            .nm-metrics { padding: 0 20px !important; }
          }
        `}</style>

        <div className="nm-cols">
          <div className="nm-col">
            <strong className="nm-col-number">
              <MetricCounter end={250} suffix="+" />
            </strong>
            <span className="nm-col-label">Active engineering teams</span>
          </div>
          <div className="nm-col">
            <strong className="nm-col-number">
              <MetricCounter end={1.2} suffix="M" decimals={1} />
            </strong>
            <span className="nm-col-label">Messages processed weekly</span>
          </div>
          <div className="nm-col">
            <strong className="nm-col-number">
              <MetricCounter end={99.95} suffix="%" decimals={2} />
            </strong>
            <span className="nm-col-label">Platform reliability target</span>
          </div>
        </div>
      </section>

      <section className="neo-cta-band">
        <h2>Ready to run your team like a high-speed command center?</h2>
        <div className="neo-actions">
          <button className="neo-btn neo-btn-purple" onClick={onEnterDashboard}>
            Launch Workspace
          </button>
          <button className="neo-btn neo-btn-yellow" onClick={onEnterChat}>
            Explore Live Chat
          </button>
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
