import { ErrorCode, type ErrorCodeType } from '@aido/api/errors';
import { BusinessError } from '@src/shared/errors';
import { ServerError } from '@src/shared/errors/infra-error';
import { createApiError } from '@src/testing/core';

import {
  INVITE_ERROR_CODE,
  isInviteCodeFieldError,
  isTerminalRedeemFailure,
  type RedeemFailureReason,
  toRedeemFailureReason,
} from './invite.error';

describe('toRedeemFailureReason', () => {
  it.each<[ErrorCodeType, RedeemFailureReason]>([
    ['INVITE_2101', 'not_found'],
    ['INVITE_2102', 'rotated'],
    ['INVITE_2103', 'self'],
    ['INVITE_2104', 'already_redeemed'],
    ['BLOCK_2204', 'blocked'],
    ['INVITE_2105', 'disabled'],
    ['INVITE_2106', 'friend_limit'],
    ['FOLLOW_0901', 'unknown'],
  ])('서버 오류 %s면 %s를 반환한다', (code, expected) => {
    // When
    const result = toRedeemFailureReason(createApiError(code, { message: 'message', status: 400 }));

    // Then
    expect(result).toBe(expected);
  });

  it('형식이 틀린 코드면 invalid_code를 반환한다', () => {
    // When
    const result = toRedeemFailureReason(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));

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

describe('isInviteCodeFieldError', () => {
  it.each([
    ['형식이 틀린 코드', new BusinessError(INVITE_ERROR_CODE.INVALID_CODE), true],
    ['없는 코드(2101)', createApiError(ErrorCode.INVITE_2101, { message: 'x' }), true],
    ['바뀐 링크(2102)', createApiError(ErrorCode.INVITE_2102, { message: 'x' }), true],
    ['내 코드(2103)', createApiError(ErrorCode.INVITE_2103, { message: 'x' }), true],
    ['이미 다른 초대 수락(2104)', createApiError(ErrorCode.INVITE_2104, { message: 'x' }), true],
    ['초대 꺼짐(2105)', createApiError(ErrorCode.INVITE_2105, { message: 'x' }), false],
    [
      '친구 한도(2106)',
      createApiError(ErrorCode.INVITE_2106, { message: 'x', status: 409 }),
      false,
    ],
    ['요청 과다(429)', createApiError(ErrorCode.SYS_0001, { message: 'x', status: 429 }), false],
    ['서버 장애', new ServerError(503), false],
  ])('%s는 코드 칸 오류인지: %s', (_case, error, expected) => {
    // When
    const result = isInviteCodeFieldError(error);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isTerminalRedeemFailure', () => {
  it.each([
    ['invalid_code', true],
    ['not_found', true],
    ['rotated', true],
    ['self', true],
    ['already_redeemed', true],
    ['blocked', true],
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
