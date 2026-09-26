/** Every key includes the society id so switching societies never shows stale data. */
export const keys = {
  me: {
    context: ['me', 'context'] as const,
    notifications: ['me', 'notifications'] as const,
  },
  society: (id: string) => ({
    all: ['society', id] as const,
    profile: ['society', id, 'profile'] as const,
    home: ['society', id, 'home'] as const,
    notices: (status: string) => ['society', id, 'notices', status] as const,
    notice: (noticeId: string) => ['society', id, 'notice', noticeId] as const,
    members: (q: string) => ['society', id, 'members', q] as const,
    member: (membershipId: string) => ['society', id, 'member', membershipId] as const,
    roles: ['society', id, 'roles'] as const,
    buildings: ['society', id, 'buildings'] as const,
    flats: ['society', id, 'flats'] as const,
    invitations: ['society', id, 'invitations'] as const,
    joinRequests: ['society', id, 'join-requests'] as const,
  }),
  join: { preview: (code: string) => ['join', 'preview', code] as const },
};
