import { invitedFriendsListResponseSchema, type InvitePreviewResponse } from '@aido/api';
import type { Page } from '@src/shared/types/page.type';
import { z } from 'zod';

import type { InvitePreview } from '../domains/invite-preview.model';
import { type InvitedFriend, InvitedFriendSchema } from '../domains/invited-friend.model';

// 날짜는 모델 스키마가 Date로 바꾸고, 모르는 보상 종류는 모델이 UNKNOWN으로 흡수한다
export const InvitedFriendsPageSchema = invitedFriendsListResponseSchema.extend({
  items: z.array(InvitedFriendSchema),
});

export const toInvitePreview = (dto: InvitePreviewResponse): InvitePreview => ({
  inviter: {
    name: dto.inviter.name,
    profileImage: dto.inviter.profileImage,
  },
});

export const toInvitedFriendsPage = (
  dto: z.output<typeof InvitedFriendsPageSchema>,
): Page<InvitedFriend> => ({
  items: dto.items,
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});
