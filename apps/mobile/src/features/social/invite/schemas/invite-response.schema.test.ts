import { createInviteDto, createRedeemResponseDto } from '../__tests__/invite.fixtures';
import {
  inviteResponseSchema,
  inviteRewardResponseSchema,
  redeemResponseSchema,
} from './invite-response.schema';

describe('inviteRewardResponseSchema', () => {
  it('모르는 보상 종류를 받으면 UNKNOWN 0개를 반환한다', () => {
    // When
    const result = inviteRewardResponseSchema.parse({ rewardType: 'BADGE', quantity: 1 });

    // Then
    expect(result).toEqual({ rewardType: 'UNKNOWN', quantity: 0 });
  });
});

describe('inviteResponseSchema', () => {
  it('받은 보상에 모르는 종류가 섞여도 응답을 버리지 않는다', () => {
    // Given
    const dto = {
      ...createInviteDto(),
      rewardsEarned: [
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'BADGE', quantity: 1 },
      ],
    };

    // When
    const result = inviteResponseSchema.parse(dto);

    // Then
    expect(result.rewardsEarned).toEqual([
      { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      { rewardType: 'UNKNOWN', quantity: 0 },
    ]);
  });
});

describe('redeemResponseSchema', () => {
  it('수락 보상에 모르는 종류가 섞여도 응답을 버리지 않는다', () => {
    // Given
    const dto = { ...createRedeemResponseDto(), rewards: [{ rewardType: 'BADGE', quantity: 1 }] };

    // When
    const result = redeemResponseSchema.parse(dto);

    // Then
    expect(result).toMatchObject({ rewards: [{ rewardType: 'UNKNOWN', quantity: 0 }] });
  });
});
