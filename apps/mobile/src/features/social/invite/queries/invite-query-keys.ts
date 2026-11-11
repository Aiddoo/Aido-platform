import type { RedemptionStatus } from '@aido/api/vocabulary';
import type { Page } from '@src/shared/types/page.types';
import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { InviteCode } from '../domains/invite-code.model';
import type { InvitePreview } from '../domains/invite-preview.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import type { Invite } from '../domains/invite.model';
import type { InvitedFriend } from '../domains/invited-friend.model';

export const INVITE_QUERY_KEYS = {
  all: ['invite'] as const,
  availability: () =>
    queryOptions<boolean>({ queryKey: [...INVITE_QUERY_KEYS.all, 'availability'] }).queryKey,
  previews: () => [...INVITE_QUERY_KEYS.all, 'preview'] as const,
  preview: ({ inviteCode }: { inviteCode: InviteCode }) =>
    queryOptions<InvitePreview>({ queryKey: [...INVITE_QUERY_KEYS.previews(), { inviteCode }] })
      .queryKey,
  me: () => queryOptions<Invite>({ queryKey: [...INVITE_QUERY_KEYS.all, 'me'] }).queryKey,
  inviteeLists: () => [...INVITE_QUERY_KEYS.all, 'invitees'] as const,
  // 전체 목록의 키는 { status: null }로 유지한다(캐시 키 모양이 바뀌지 않게)
  invitees: ({ status }: { status?: RedemptionStatus }) =>
    queryOptions<InfiniteData<Page<InvitedFriend>, string | undefined>>({
      queryKey: [...INVITE_QUERY_KEYS.inviteeLists(), { status: status ?? null }],
    }).queryKey,
  redemption: ({ inviterId }: { inviterId: string | null }) =>
    queryOptions<RedemptionResult>({
      queryKey: [...INVITE_QUERY_KEYS.all, 'redemption', { inviterId }],
    }).queryKey,
} as const;
