import { type InvitePreviewResponse, invitePreviewResponseSchema } from '@aido/api';
import { ApiError } from '@src/shared/errors/api-error';

import type { PendingRedemption } from '../domains/invite-redemption.model';

export const createPendingRedemption = (
  overrides?: Partial<PendingRedemption>,
): PendingRedemption => ({
  inviteCode: 'K7M2QX',
  source: 'universal_link',
  savedAt: new Date('2028-02-23T00:00:00Z'),
  ownerId: null,
  ...overrides,
});

// 공개 미리보기에서 태그가 빠져도 그대로 쓰이게 서버 계약 스키마로 만든다(모르는 필드는 버린다)
export const createInvitePreviewDto = (
  overrides?: Partial<InvitePreviewResponse['inviter']>,
): InvitePreviewResponse =>
  invitePreviewResponseSchema.parse({
    inviter: { name: '민지', userTag: 'K3MQ9XWA', profileImage: 'orange_tabby', ...overrides },
  });

export const createInviteApiError = ({
  code = 'INVITE_2101',
  status = 404,
}: { code?: string; status?: number } = {}) =>
  new ApiError(code, '초대 코드를 찾을 수 없어요', status);

export const INVALID_DTO = { invalid: 'data' };
