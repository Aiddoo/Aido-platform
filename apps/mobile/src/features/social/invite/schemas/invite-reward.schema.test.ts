import { inviteRewardOrUnknownSchema } from './invite-reward.schema';

describe('inviteRewardOrUnknownSchema', () => {
  it('모르는 보상 종류를 받으면 UNKNOWN 0개를 반환한다', () => {
    // When
    const result = inviteRewardOrUnknownSchema.parse({ rewardType: 'BADGE', quantity: 1 });

    // Then
    expect(result).toEqual({ rewardType: 'UNKNOWN', quantity: 0 });
  });
});
