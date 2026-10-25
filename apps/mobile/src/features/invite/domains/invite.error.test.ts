import { ApiError } from '@src/shared/errors/api-error';
import { ServerError } from '@src/shared/errors/infra-error';

import { InviteErrors, isTerminalRedeemFailure, toRedeemFailureReason } from './invite.error';

describe('toRedeemFailureReason', () => {
  it.each([
    ['INVITE_2101', 'not_found'],
    ['INVITE_2102', 'rotated'],
    ['INVITE_2103', 'self'],
    ['INVITE_2104', 'already_redeemed'],
    ['INVITE_2105', 'disabled'],
    ['INVITE_2106', 'friend_limit'],
    ['FOLLOW_0501', 'unknown'],
  ])('서버 오류 %s면 %s를 반환한다', (code, expected) => {
    // When
    const result = toRedeemFailureReason(new ApiError(code, 'message', 400));

    // Then
    expect(result).toBe(expected);
  });

  it('형식이 틀린 코드면 invalid_code를 반환한다', () => {
    // When
    const result = toRedeemFailureReason(InviteErrors.invalidCode());

    // Then
    expect(result).toBe('invalid_code');
  });

  it('서버 장애면 unknown을 반환한다', () => {
    // When
    const result = toRedeemFailureReason(new ServerError(500));

    // Then
    expect(result).toBe('unknown');
  });
});

describe('isTerminalRedeemFailure', () => {
  it.each([
    ['invalid_code', true],
    ['not_found', true],
    ['rotated', true],
    ['self', true],
    ['already_redeemed', true],
    ['disabled', false],
    ['friend_limit', false],
    ['unknown', false],
  ] as const)('%s면 %s를 반환한다', (reason, expected) => {
    // When
    const result = isTerminalRedeemFailure(reason);

    // Then
    expect(result).toBe(expected);
  });
});
