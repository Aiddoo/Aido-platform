import type { InviteCode } from '../domains/invite.model';

export const INVITE_QUERY_KEYS = {
  all: ['invite'] as const,
  availability: () => [...INVITE_QUERY_KEYS.all, 'availability'] as const,
  previews: () => [...INVITE_QUERY_KEYS.all, 'preview'] as const,
  preview: ({ inviteCode }: { inviteCode: InviteCode }) =>
    [...INVITE_QUERY_KEYS.previews(), { inviteCode }] as const,
  clipboardPresence: () => [...INVITE_QUERY_KEYS.all, 'clipboard-presence'] as const,
} as const;
