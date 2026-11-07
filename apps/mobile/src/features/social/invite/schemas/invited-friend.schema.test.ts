import { createInvitedFriendDto } from '../__tests__/invite.fixtures';
import { invitedFriendSchema } from './invited-friend.schema';

describe('invitedFriendSchema', () => {
  it('모르는 상태와 보상 제외 사유는 UNKNOWN과 null로 받는다', () => {
    // Given
    const dto = { ...createInvitedFriendDto(), status: 'PAUSED', rejectionReason: 'NEW_REASON' };

    // When
    const result = invitedFriendSchema.parse(dto);

    // Then
    expect(result).toMatchObject({ status: 'UNKNOWN', rejectionReason: null });
  });
});
