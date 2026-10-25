import type { RedemptionStatus } from '@aido/api';

import type { InviteCode } from '../domains/invite.model';

export const INVITE_QUERY_KEYS = {
  all: ['invite'] as const,
  previews: () => [...INVITE_QUERY_KEYS.all, 'preview'] as const,
  preview: ({ inviteCode }: { inviteCode: InviteCode }) =>
    [...INVITE_QUERY_KEYS.previews(), { inviteCode }] as const,
  invite: () => [...INVITE_QUERY_KEYS.all, 'me'] as const,
  inviteeLists: () => [...INVITE_QUERY_KEYS.all, 'invitees'] as const,
  invitees: ({ status }: { status: RedemptionStatus | null }) =>
    [...INVITE_QUERY_KEYS.inviteeLists(), { status }] as const,
  redemption: ({ inviterId }: { inviterId: string }) =>
    [...INVITE_QUERY_KEYS.all, 'redemption', { inviterId }] as const,
  clipboardPresence: () => [...INVITE_QUERY_KEYS.all, 'clipboard-presence'] as const,
} as const;
