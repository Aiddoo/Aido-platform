import type { InvitePreviewResponse } from '@aido/api';

import type { InvitePreview } from '../domains/invite-preview.model';

export const toInvitePreview = (dto: InvitePreviewResponse): InvitePreview => ({
  inviter: {
    name: dto.inviter.name,
    profileImage: dto.inviter.profileImage,
  },
});
