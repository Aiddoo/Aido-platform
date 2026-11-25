import { ErrorCode, type ErrorCodeType } from '@aido/api/errors';
import { BusinessError } from '@src/shared/errors';
import { ServerError } from '@src/shared/errors/infra-error';
import { createApiError } from '@src/testing/core';

import {
  findInviteCodeFieldError,
  INVITE_CODE_SERVER_ERROR_TYPE,
  INVITE_ERROR_CODE,
  isInviteCodeFieldError,
  isTerminalRedeemFailure,
  type RedeemFailureReason,
  getRedeemFailureReason,
} from './invite.error';

describe('getRedeemFailureReason', () => {
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
    const result = getRedeemFailureReason(
      createApiError(code, { message: 'message', status: 400 }),
    );

    // Then
    expect(result).toBe(expected);
  });

  it('형식이 틀린 코드면 invalid_code를 반환한다', () => {
    // When
    const result = getRedeemFailureReason(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));

    // Then
    expect(result).toBe('invalid_code');
  });

  it('서버 장애면 unknown을 반환한다', () => {
    // When
    const result = getRedeemFailureReason(new ServerError(500));

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

describe('findInviteCodeFieldError', () => {
  it.each([
    ErrorCode.INVITE_2101,
    ErrorCode.INVITE_2102,
    ErrorCode.INVITE_2103,
    ErrorCode.INVITE_2104,
  ])('코드 칸에 붙는 거절(%s)은 서버 문구를 실은 칸 오류다', (code) => {
    // When
    const result = findInviteCodeFieldError(createApiError(code, { message: '서버 안내' }));

    // Then
    expect(result).toEqual({ type: INVITE_CODE_SERVER_ERROR_TYPE, message: '서버 안내' });
  });

  it.each([
    ['초대 꺼짐(2105)', createApiError(ErrorCode.INVITE_2105, { message: 'x' })],
    ['친구 한도(2106)', createApiError(ErrorCode.INVITE_2106, { message: 'x', status: 409 })],
    ['서버 장애', new ServerError(503)],
  ])('%s는 칸 오류가 아니다', (_case, error) => {
    // When
    const result = findInviteCodeFieldError(error);

    // Then
    expect(result).toBeNull();
  });

  it('서버 문구가 비었으면 문구 없이 칸 오류만 돌려줘 칸이 기본 안내를 고르게 한다', () => {
    // When
    const result = findInviteCodeFieldError(
      createApiError(ErrorCode.INVITE_2101, { message: '  ' }),
    );

    // Then
    expect(result).toEqual({ type: INVITE_CODE_SERVER_ERROR_TYPE, message: undefined });
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
