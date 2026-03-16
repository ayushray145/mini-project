import { useState } from 'react';

const channels = ['welcome', 'announcements', 'frontend-help', 'backend-help', 'showcase'];

const channelDetails = {
  welcome: {
    title: 'Welcome',
    summary: 'Start here for quick pointers, team norms, and how DevRooms works.',
    highlights: ['# Introductions and team norms', '# How to use rooms effectively', '# Best practices & etiquette'],
  },
  announcements: {
    title: 'Announcements',
    summary: 'Release notes, schedule changes, and critical project updates.',
    highlights: ['# Release windows and hotfixes', '# Leadership updates', '# Policy changes'],
  },
  'frontend-help': {
    title: 'Frontend Help',
    summary: 'UI bugs, design reviews, and component support.',
    highlights: ['# Component reviews', '# UI bug triage', '# Design system usage'],
  },
  'backend-help': {
    title: 'Backend Help',
    summary: 'APIs, data pipelines, and production investigations.',
    highlights: ['# API contract questions', '# DB migration checks', '# Service health triage'],
  },
  showcase: {
    title: 'Showcase',
    summary: 'Ship it loud. Demos, wins, and shipping updates.',
    highlights: ['# Weekly demos', '# Before/after snapshots', '# Team wins'],
  },
};

const contacts = [
  { name: 'Ayush', role: 'Frontend Lead', status: 'Online' },
  { name: 'Ashwin', role: 'Backend Engineer', status: 'Online' },
  { name: 'Mia (AI)', role: 'Assistant Bot', status: 'Available' },
  { name: 'Amritanshu', role: 'DevOps Engineer', status: 'Away' },
];

export default function Dashboard() {
  const [activeChannel, setActiveChannel] = useState(channels[0]);
  const [isChannelView, setIsChannelView] = useState(false);
  const channelInfo = channelDetails[activeChannel];

  const downloadBlueprint = () => {
    const escapePdfText = (value) => value.replace(/[\\()]/g, '\\$&');
    const lines = [
      `Channel: ${channelInfo.title}`,
      '',
      channelInfo.summary,
      '',
      'Highlights:',
      ...channelInfo.highlights.map((item) => `- ${item}`),
    ];
    const textLines = lines.map((line, index) => {
      const prefix = index === 0 ? '72 720 Td' : '0 -20 Td';
      return `${prefix} (${escapePdfText(line)}) Tj`;
    });
    const stream = `BT\n/F1 16 Tf\n${textLines.join('\n')}\nET`;
    const objects = [];
    const offsets = [];
    const pushObject = (content) => {
      offsets.push(objects.join('\n').length + (objects.length ? 1 : 0));
      objects.push(content);
    };

    pushObject('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
    pushObject('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
    pushObject('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');
    pushObject(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
    pushObject('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

    const header = '%PDF-1.4';
    const body = objects.join('\n');
    const xrefOffset = header.length + 1 + body.length + 1;
    const xrefEntries = ['0000000000 65535 f '].concat(
      offsets.map((offset) => `${String(offset + header.length + 1).padStart(10, '0')} 00000 n `),
    );
    const xref = `xref\n0 ${xrefEntries.length}\n${xrefEntries.join('\n')}`;
    const trailer = `trailer\n<< /Size ${xrefEntries.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const pdf = `${header}\n${body}\n${xref}\n${trailer}`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeChannel}-blueprint.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page-grid">
      <aside className="panel channels-panel">
        <div className="panel-title">Text Channels</div>
        <ul className="channel-list">
          {channels.map((channel) => (
            <li
              key={channel}
              className={`channel-item ${activeChannel === channel ? 'active' : ''}`}
              onClick={() => {
                setActiveChannel(channel);
                setIsChannelView(true);
              }}
            >
              <span className="hash">#</span>
              {channel}
            </li>
          ))}
        </ul>
      </aside>

      <div className="panel content-panel">
        {isChannelView ? (
          <>
            <div className="dashboard-channel-top">
              <div className="dashboard-channel-header">
                <span className="hash">#</span>
                <h1>{channelInfo.title}</h1>
              </div>
              <button type="button" className="dashboard-download-btn" onClick={downloadBlueprint}>
                Download PDF
              </button>
            </div>
            <p className="muted">{channelInfo.summary}</p>

            <div className="dashboard-channel-body dashboard-message-list">
              {channelInfo.highlights.map((item) => (
                <div key={item} className="dashboard-message">
                  <div className="dashboard-message-meta">
                    <strong>{item}</strong>
                  </div>
                  <p>Use this space to coordinate tasks, post updates, and tag owners for quick response.</p>
                </div>
              ))}
            </div>

          </>
        ) : (
          <>
            <h1>Welcome to DevRooms</h1>
            <p className="muted">
              SaaS-grade collaboration hub for engineering teams. Jump into channels, start voice calls,
              and coordinate code reviews with focused updates.
            </p>

            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">Members Online</span>
                <strong>128</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Active Rooms</span>
                <strong>14</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Deploys Today</span>
                <strong>9</strong>
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="panel activity-panel">
        <div className="panel-title">Contacts</div>
        <div className="activity-list">
          {contacts.map((contact) => (
            <article key={contact.name} className="activity-card">
              <h3>{contact.name}</h3>
              <p>{contact.role}</p>
              <span className={`status-tag status-${contact.status.toLowerCase()}`}>{contact.status}</span>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}
