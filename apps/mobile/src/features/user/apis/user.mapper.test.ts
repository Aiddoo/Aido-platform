import { PREMIUM_ME_EXAMPLES } from '@src/features/subscription/__tests__/premium-access.factories';

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

  test('지금 기간의 끝을 보내기 전 서버면 그 서버의 끝(premiumEndsAt)을 지금 기간의 끝으로 본다', () => {
    // Given premiumPeriodEndsAt이 없는 1.12 서버 응답
    const dto = createCurrentUserDto({
      premiumSource: 'GRANT',
      premiumEndsAt: '2026-11-01T05:30:00.000Z',
      willRenew: false,
      bankedPremiumDays: 0,
    });

    // When
    const result = toUser(dto);

    // Then
    expect(result.premiumAccess.periodEndsAt).toEqual(new Date('2026-11-01T05:30:00.000Z'));
  });

  test('구버전 서버가 프리미엄 출처를 보내지 않으면 출처 없음으로 본다', () => {
    // Given
    const dto = createCurrentUserDto();

    // When
    const result = toUser(dto);

    // Then
    expect(result.premiumAccess).toEqual({
      source: null,
      endsAt: null,
      periodEndsAt: null,
      willRenew: false,
      bankedDays: 0,
      grantEndedAt: null,
    });
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
