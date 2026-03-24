import { useState } from 'react';

export default function Dashboard({
  communities = [],
  activeCommunityId,
  onOpenCommunity,
  onOpenCommunityModal,
  onDeleteCommunity,
  showOwnerFeatures = true,
  pageName = 'Dashboard',
  debugInfo = null,
}) {
  const [copiedCommunityId, setCopiedCommunityId] = useState('');
  const featuredCommunity = communities.find((community) => community.id === activeCommunityId) || communities[0] || null;

  const copyInviteCode = async (communityId, inviteCode) => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCommunityId(communityId);
      window.setTimeout(() => {
        setCopiedCommunityId((current) => (current === communityId ? '' : current));
      }, 1600);
    } catch (_) {
      setCopiedCommunityId('');
    }
  };

  const handleDeleteCommunity = async (community) => {
    if (!community?.id) return;
    const confirmed = window.confirm(`Delete "${community.label}" permanently? This removes its channels and messages too.`);
    if (!confirmed) return;
    try {
      await onDeleteCommunity?.(community.id);
    } catch (error) {
      window.alert(error?.message || 'Failed to delete community');
    }
  };

  const emptyTitle = showOwnerFeatures ? 'No communities yet' : 'No community joined';
  const emptyDescription = showOwnerFeatures
    ? 'Create a community to generate a unique key and open its chatroom from here.'
    : 'Join a community to access its chatrooms from here.';
  const pageKicker = showOwnerFeatures ? 'Trusted developer collaboration' : 'Explore shared spaces';
  const pageTitleLead = showOwnerFeatures ? 'Control your' : 'Explore your';
  const pageTitleAccent = showOwnerFeatures ? 'communities' : 'communities';

  return (
    <section className="dashboard-shell">
      <div className="dashboard-hero-card">
        <div className="dashboard-hero-copy">
          <div className="dashboard-brand-mark">
            <span className="dashboard-brand-icon" aria-hidden="true">
              #
            </span>
            <span>{`DevRooms ${pageName}`}</span>
          </div>

          <div className="dashboard-title-wrap">
            <p className="dashboard-kicker">{pageKicker}</p>
            <h1>
              {pageTitleLead}
              <em>{` ${pageTitleAccent}`}</em>
            </h1>
          </div>

          {debugInfo && (
            <div className="dashboard-debug-panel">
              <strong>Debug</strong>
              <span>{`view: ${debugInfo.view}`}</span>
              <span>{`hasDashboardAccess: ${String(debugInfo.hasDashboardAccess)}`}</span>
              <span>{`hasChatroomsAccess: ${String(debugInfo.hasChatroomsAccess)}`}</span>
              <span>{`activeCommunityRole: ${debugInfo.activeCommunityRole || 'none'}`}</span>
              <span>{`activeCommunityIsAdmin: ${String(debugInfo.activeCommunityIsAdmin)}`}</span>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-side-column">
        <div className="dashboard-hero-metric">
          <strong>{featuredCommunity ? `+${featuredCommunity.members || 1}` : '+0'}</strong>
          <span>{featuredCommunity ? 'People in this community' : 'People per community'}</span>
        </div>

        <div className="dashboard-grid">
          {communities.length > 0 ? (
            communities.map((community) => {
              const memberCount = community.members || 0;
              const channelCount = community.channels?.length || 0;
              const roomId = community.channels?.[0]?.roomId;
              const isActive = community.id === activeCommunityId;
              return (
                <article key={community.id} className={`dashboard-community-card ${isActive ? 'active' : ''}`}>
                  <div className="dashboard-community-top">
                    <div>
                      <span className="dashboard-community-label">Community</span>
                      <h2>{community.label}</h2>
                    </div>
                    <div className="dashboard-community-actions">
                      <span className="dashboard-community-status">{Math.max(1, Math.floor(memberCount * 0.6))} online</span>
                      {showOwnerFeatures && (
                        <button
                          type="button"
                          className="dashboard-community-delete"
                          onClick={() => handleDeleteCommunity(community)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="dashboard-community-stats">
                    <div>
                      <strong>{memberCount}</strong>
                      <span>Members</span>
                    </div>
                    <div>
                      <strong>{channelCount}</strong>
                      <span>Channels</span>
                    </div>
                  </div>

                  {showOwnerFeatures && (
                    <div className="dashboard-community-key">
                      <label>Unique key</label>
                      <div className="dashboard-community-key-row">
                        <code>{community.inviteCode || 'Member access only'}</code>
                        <button
                          type="button"
                          className="dashboard-copy-key"
                          aria-label="Copy access key"
                          onClick={() => copyInviteCode(community.id, community.inviteCode)}
                          disabled={!community.inviteCode}
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
                            <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      {copiedCommunityId === community.id && (
                        <span className="dashboard-copy-status">Copied</span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="dashboard-community-open"
                    onClick={() => roomId && onOpenCommunity?.(community.id, roomId)}
                    disabled={!roomId}
                  >
                    Access Chatroom
                  </button>

                  {isActive && (
                    <button
                      type="button"
                      className="dashboard-card-fab"
                      aria-label="Create or join a community"
                      onClick={() => onOpenCommunityModal?.('create')}
                    >
                      +
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <div className="dashboard-empty-card">
              <h2>{emptyTitle}</h2>
              <p>{emptyDescription}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
