import type { RedemptionStatus } from '@aido/api/vocabulary';

import type { InviteCode } from '../domains/invite-code.model';

export const INVITE_QUERY_KEYS = {
  all: ['invite'] as const,
  availability: () => [...INVITE_QUERY_KEYS.all, 'availability'] as const,
  previews: () => [...INVITE_QUERY_KEYS.all, 'preview'] as const,
  preview: ({ inviteCode }: { inviteCode: InviteCode }) =>
    [...INVITE_QUERY_KEYS.previews(), { inviteCode }] as const,
  me: () => [...INVITE_QUERY_KEYS.all, 'me'] as const,
  inviteeLists: () => [...INVITE_QUERY_KEYS.all, 'invitees'] as const,
  // 전체 목록의 키는 { status: null }로 유지한다(캐시 키 모양이 바뀌지 않게)
  invitees: ({ status }: { status?: RedemptionStatus }) =>
    [...INVITE_QUERY_KEYS.inviteeLists(), { status: status ?? null }] as const,
  redemption: ({ inviterId }: { inviterId: string | null }) =>
    [...INVITE_QUERY_KEYS.all, 'redemption', { inviterId }] as const,
} as const;
