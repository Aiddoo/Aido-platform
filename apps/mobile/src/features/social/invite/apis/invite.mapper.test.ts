import {
  createInviteDto,
  createInvitedFriendDto,
  createInvitePreviewDto,
  createRedeemResponseDto,
} from '../__tests__/invite.fixtures';
import { invitePreviewSchema } from '../domains/invite-preview.model';
import { redemptionResultSchema } from '../domains/invite-redemption.model';
import { inviteSchema } from '../domains/invite.model';
import { invitedFriendSchema } from '../domains/invited-friend.model';
import {
  inviteResponseSchema,
  invitedFriendsResponseSchema,
  redeemResponseSchema,
} from '../schemas/invite-response.schema';
import {
  toInvite,
  toInvitedFriendsPage,
  toInvitePreview,
  toRedemptionResult,
} from './invite.mapper';

describe('toInvite', () => {
  it('계약을 통과한 내 초대 응답은 앱 초대 모델도 통과한다', () => {
    // Given
    const dto = inviteResponseSchema.parse(createInviteDto());

    // When
    const invite = toInvite(dto);

    // Then
    expect(inviteSchema.parse(invite)).toEqual(invite);
    expect(invite.createdAt).toBe('2026-11-01T09:00:00.000Z');
  });

  it('다음 단계가 없으면 null로 둔다', () => {
    // Given
    const dto = inviteResponseSchema.parse(createInviteDto({ nextMilestone: null }));

    // When
    const invite = toInvite(dto);

    // Then
    expect(invite.nextMilestone).toBeNull();
  });
});

describe('toRedemptionResult', () => {
  it('다시 수락이 아닌 응답은 처음 수락으로 읽는다', () => {
    // Given
    const dto = redeemResponseSchema.parse(createRedeemResponseDto());

    // When
    const result = toRedemptionResult(dto);

    // Then
    expect(result).toMatchObject({ outcome: 'REDEEMED', isReplay: false });
    expect(redemptionResultSchema.parse(result)).toEqual(result);
  });

  it('다시 수락이면 그 표시를 옮긴다', () => {
    // Given
    const dto = redeemResponseSchema.parse(createRedeemResponseDto({ isReplay: true }));

    // When
    const result = toRedemptionResult(dto);

    // Then
    expect(result).toMatchObject({ isReplay: true });
  });

  it('이미 친구였으면 친구 상태와 보상 없이 초대한 사람만 옮긴다', () => {
    // Given
    const dto = redeemResponseSchema.parse({
      outcome: 'ALREADY_FRIENDS',
      inviter: createRedeemResponseDto().inviter,
    });

    // When
    const result = toRedemptionResult(dto);

    // Then
    expect(result).toEqual({ outcome: 'ALREADY_FRIENDS', inviter: dto.inviter });
  });

  it('기존 계정이 연결됐으면 친구 상태만 옮긴다', () => {
    // Given
    const dto = redeemResponseSchema.parse({
      outcome: 'CONNECTED',
      inviter: createRedeemResponseDto().inviter,
      friendship: 'REQUESTED',
    });

    // When
    const result = toRedemptionResult(dto);

    // Then
    expect(result).toEqual({ outcome: 'CONNECTED', inviter: dto.inviter, friendship: 'REQUESTED' });
  });
});

describe('toInvitePreview', () => {
  it('공개하지 않는 태그는 빼고 이름과 프로필만 옮긴다', () => {
    // Given
    const dto = createInvitePreviewDto();

    // When
    const preview = toInvitePreview(dto);

    // Then
    expect(preview).toEqual({ inviter: { name: '민지', profileImage: 'orange_tabby' } });
    expect(invitePreviewSchema.parse(preview)).toEqual(preview);
  });
});

describe('toInvitedFriendsPage', () => {
  it('모르는 상태와 보상 제외 사유는 UNKNOWN과 null로 받는다', () => {
    // Given
    const dto = invitedFriendsResponseSchema.parse({
      items: [{ ...createInvitedFriendDto(), status: 'PAUSED', rejectionReason: 'NEW_REASON' }],
      totalCount: 1,
      hasMore: false,
    });

    // When
    const page = toInvitedFriendsPage(dto);

    // Then
    expect(page.items[0]).toMatchObject({ status: 'UNKNOWN', rejectionReason: null });
  });

  it('계약을 통과한 초대 친구는 앱 모델도 통과하고 시각은 순간으로 읽는다', () => {
    // Given
    const dto = invitedFriendsResponseSchema.parse({
      items: [createInvitedFriendDto({ qualifiedAt: '2026-11-03T10:30:00.000Z' })],
      totalCount: 1,
      hasMore: false,
    });

    // When
    const page = toInvitedFriendsPage(dto);

    // Then
    expect(page).toMatchObject({ totalCount: 1, nextCursor: null });
    expect(invitedFriendSchema.parse(page.items[0])).toEqual(page.items[0]);
    expect(page.items[0]?.qualifiedAt).toBe('2026-11-03T10:30:00.000Z');
  });
});
