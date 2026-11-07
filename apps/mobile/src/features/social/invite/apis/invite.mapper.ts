import type { InvitePreviewResponse } from '@aido/api';
import type { Page } from '@src/shared/types/page.types';
import { pick } from 'es-toolkit';

import type { InvitePreview } from '../schemas/invite-preview.schema';
import type { InvitedFriend, InvitedFriendsPage } from '../schemas/invited-friend.schema';

export function toInvitePreview(dto: InvitePreviewResponse): InvitePreview {
  return { inviter: pick(dto.inviter, ['name', 'profileImage']) };
}

export function toInvitedFriendsPage(dto: InvitedFriendsPage): Page<InvitedFriend> {
  return pick(dto, ['items', 'totalCount', 'hasMore']);
}
