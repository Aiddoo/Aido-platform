import { toInstant } from '@src/shared/date/instant';

import { PREMIUM_ME_EXAMPLES } from '../__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '../__tests__/user.fixtures';
import { currentUserResponseSchema } from '../schemas/user-response.schema';
import { toUser } from './user.mapper';

describe('toUser', () => {
  it('userId → id, createdAt ISO → Instant 매핑', () => {
    // Given
    const dto = createCurrentUserDto();

    // When
    const result = toUser(dto);

    // Then
    expect(result.id).toBe(dto.userId);
    expect(result.email).toBe(dto.email);
    expect(result.createdAt).toBe(dto.createdAt);
  });

  it.each([
    [
      'A. 보상 중 구독: 지금 기간은 스토어 만료, 전체 끝은 쌓아 둔 5일까지',
      PREMIUM_ME_EXAMPLES.buyDuringReward,
      {
        source: 'STORE',
        endsAt: toInstant('2028-03-15T07:00:00.000Z'),
        periodEndsAt: toInstant('2028-03-10T04:00:00.000Z'),
        willRenew: true,
        isTrial: false,
        bankedDays: 5,
        grantEndedAt: null,
        planType: null,
      },
    ],
    [
      'B. 보상 중 보상: 지금 보상의 끝과 이어 붙인 전체 끝을 따로 옮긴다',
      PREMIUM_ME_EXAMPLES.rewardDuringReward,
      {
        source: 'GRANT',
        endsAt: toInstant('2028-03-11T04:00:00.000Z'),
        periodEndsAt: toInstant('2028-03-04T04:00:00.000Z'),
        willRenew: false,
        isTrial: false,
        bankedDays: 7,
        grantEndedAt: null,
        planType: null,
      },
    ],
    [
      'D. 보상이 끝나 무료면 끝난 시각만 옮긴다',
      PREMIUM_ME_EXAMPLES.endedReward,
      {
        source: null,
        endsAt: null,
        periodEndsAt: null,
        willRenew: false,
        isTrial: false,
        bankedDays: 0,
        grantEndedAt: toInstant('2028-03-04T04:00:00.000Z'),
        planType: null,
      },
    ],
  ] as const)('%s', (_case, dto, expected) => {
    // When
    const result = toUser(dto);

    // Then
    expect(result.premiumAccess).toEqual(expected);
  });

  it.each([
    ['서버가 체험이라고 보내면 체험으로 옮긴다', true, true],
    ['서버가 체험이 아니라고 보내면 체험이 아닌 것으로 옮긴다', false, false],
  ] as const)('%s', (_case, premiumIsTrial, expected) => {
    // Given
    const dto = { ...PREMIUM_ME_EXAMPLES.trialDuringReward, premiumIsTrial };

    // When
    const result = toUser(dto);

    // Then
    expect(result.premiumAccess.isTrial).toBe(expected);
  });
});

describe('currentUserResponseSchema', () => {
  it('프리미엄 효력·권한이 빠진 응답은 받아들이지 않는다', () => {
    // Given
    const { isPremium: _isPremium, entitlements: _entitlements, ...dto } = createCurrentUserDto();

    // When
    const result = currentUserResponseSchema.safeParse(dto);

    // Then
    expect(result.success).toBe(false);
  });
});
