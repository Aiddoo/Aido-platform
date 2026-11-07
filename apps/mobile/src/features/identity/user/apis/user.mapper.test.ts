import { toInstant } from '@src/shared/date/instant';

import { PREMIUM_ME_EXAMPLES } from '../__tests__/premium-access.fixtures';
import { createCurrentUserDto, createUpdateProfileDto } from '../__tests__/user.fixtures';
import { toUpdateProfileResult, toUser } from './user.mapper';

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

  it('name null → null 유지', () => {
    // Given
    const dto = createCurrentUserDto({ name: null });

    // When
    const result = toUser(dto);

    // Then
    expect(result.name).toBeNull();
  });

  it('profileImage null → null 유지', () => {
    // Given
    const dto = createCurrentUserDto({ profileImage: null });

    // When
    const result = toUser(dto);

    // Then
    expect(result.profileImage).toBeNull();
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
        bankedDays: 5,
        grantEndedAt: null,
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
        grantEndedAt: toInstant('2028-03-04T04:00:00.000Z'),
      },
    ],
  ] as const)('%s', (_case, dto, expected) => {
    // When
    const result = toUser(dto);

    // Then
    expect(result.premiumAccess).toEqual(expected);
  });

  it('providers 배열 매핑', () => {
    // Given
    const dto = createCurrentUserDto({ providers: ['CREDENTIAL', 'GOOGLE'] });

    // When
    const result = toUser(dto);

    // Then
    expect(result.providers).toEqual(['CREDENTIAL', 'GOOGLE']);
  });
});

describe('toUpdateProfileResult', () => {
  it('name, profileImage만 추출 (message 제외)', () => {
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

  it('name null → null 유지', () => {
    // Given
    const dto = createUpdateProfileDto({ name: null });

    // When
    const result = toUpdateProfileResult(dto);

    // Then
    expect(result.name).toBeNull();
  });
});
