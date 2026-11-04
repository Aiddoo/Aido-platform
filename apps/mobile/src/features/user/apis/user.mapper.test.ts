import { PREMIUM_ME_EXAMPLES } from '@src/features/subscription/__tests__/premium-access.factories';
import { createPremiumEntitlementsDto } from '@src/features/subscription/__tests__/premium-entitlement.factories';

import { createCurrentUserDto, createUpdateProfileDto } from '../__tests__/user.factories';
import { toUpdateProfileResult, toUser } from './user.mapper';

describe('toUser', () => {
  test('userId → id, createdAt ISO → Date 매핑', () => {
    // Given
    const dto = createCurrentUserDto();

    // When
    const result = toUser(dto);

    // Then
    expect(result.id).toBe(dto.userId);
    expect(result.email).toBe(dto.email);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(dto.createdAt);
  });

  test('name null → null 유지', () => {
    // Given
    const dto = createCurrentUserDto({ name: null });

    // When
    const result = toUser(dto);

    // Then
    expect(result.name).toBeNull();
  });

  test('profileImage null → null 유지', () => {
    // Given
    const dto = createCurrentUserDto({ profileImage: null });

    // When
    const result = toUser(dto);

    // Then
    expect(result.profileImage).toBeNull();
  });

  test.each([
    [
      'A. 보상 중 구독: 지금 기간은 스토어 만료, 전체 끝은 쌓아 둔 5일까지',
      PREMIUM_ME_EXAMPLES.buyDuringReward,
      {
        source: 'STORE',
        endsAt: new Date('2028-03-15T07:00:00.000Z'),
        periodEndsAt: new Date('2028-03-10T04:00:00.000Z'),
        willRenew: true,
        bankedDays: 5,
        grantEndedAt: null,
      },
    ],
    [
      'B. 보상 중 보상: 지금 보상의 끝과 이어 붙인 전체 끝을 따로 옮긴다',
      PREMIUM_ME_EXAMPLES.rewardDuringReward,
      {
        source: 'GRANT',
        endsAt: new Date('2028-03-11T04:00:00.000Z'),
        periodEndsAt: new Date('2028-03-04T04:00:00.000Z'),
        willRenew: false,
        bankedDays: 7,
        grantEndedAt: null,
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
        bankedDays: 0,
        grantEndedAt: new Date('2028-03-04T04:00:00.000Z'),
      },
    ],
  ] as const)('%s', (_case, dto, expected) => {
    // When
    const result = toUser(dto);

    // Then
    expect(result.premiumAccess).toEqual(expected);
  });

  test('기능별 권한의 초기화 시각을 Date로 바꾸고 모르는 기능 키는 버린다', () => {
    // Given 새 서버가 앱이 모르는 기능을 더해 보냈다
    const dto = createCurrentUserDto({
      isPremium: false,
      entitlements: {
        ...createPremiumEntitlementsDto({
          NUDGE: { allowed: true, limit: 3, used: 3, resetsAt: '2026-11-01T15:00:00.000Z' },
        }),
        FUTURE_FEATURE: { allowed: true, limit: null },
      },
    });

    // When
    const result = toUser(dto);

    // Then
    expect(result.isPremium).toBe(false);
    expect(result.entitlements.NUDGE).toEqual({
      allowed: true,
      limit: 3,
      used: 3,
      resetsAt: new Date('2026-11-01T15:00:00.000Z'),
    });
    expect(result.entitlements).not.toHaveProperty('FUTURE_FEATURE');
  });

  test('providers 배열 매핑', () => {
    // Given
    const dto = createCurrentUserDto({ providers: ['CREDENTIAL', 'GOOGLE'] });

    // When
    const result = toUser(dto);

    // Then
    expect(result.providers).toEqual(['CREDENTIAL', 'GOOGLE']);
  });
});

describe('toUpdateProfileResult', () => {
  test('name, profileImage만 추출 (message 제외)', () => {
    // Given
    const dto = createUpdateProfileDto();

    // When
    const result = toUpdateProfileResult(dto);

    // Then
    expect(result).toEqual({
      name: dto.name,
      profileImage: dto.profileImage,
    });
    expect(result).not.toHaveProperty('message');
  });

  test('name null → null 유지', () => {
    // Given
    const dto = createUpdateProfileDto({ name: null });

    // When
    const result = toUpdateProfileResult(dto);

    // Then
    expect(result.name).toBeNull();
  });
});
