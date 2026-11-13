import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { ClipboardCopyError } from '@src/core/ports/clipboard-gateway';
import { ZodError } from 'zod';

import { BusinessError } from './business-error';
import { classifyError, type ErrorKind } from './classify-error';
import { NetworkError, ParseError, ServerError, TimeoutError } from './infra-error';
import { KeychainLockedError } from './storage-error';

describe('classifyError', () => {
  it.each<[string, unknown, ErrorKind, 'event' | 'breadcrumb']>([
    [
      '400 ApiError',
      new ApiError(ErrorCode.SYS_0002, '잘못된 요청', 400),
      'expected',
      'breadcrumb',
    ],
    [
      '403 ApiError(기능 꺼짐)',
      new ApiError(ErrorCode.INVITE_2105, '꺼짐', 403),
      'expected',
      'breadcrumb',
    ],
    ['404 ApiError', new ApiError(ErrorCode.TODO_0801, '없음', 404), 'expected', 'breadcrumb'],
    ['429 ApiError', new ApiError(ErrorCode.SYS_0001, '잠시 후', 429), 'expected', 'breadcrumb'],
    [
      '401 ApiError',
      new ApiError(ErrorCode.AUTH_0101, '다시 로그인', 401),
      'auth-expired',
      'breadcrumb',
    ],
    ['BusinessError', new BusinessError('FRIEND_EMPTY_TAG'), 'expected', 'breadcrumb'],
    ['키체인 잠금', new KeychainLockedError(new Error('locked')), 'expected', 'breadcrumb'],
    ['네트워크 끊김', new NetworkError(), 'connectivity', 'breadcrumb'],
    ['시간 초과', new TimeoutError(), 'connectivity', 'breadcrumb'],
    ['5xx ServerError', new ServerError(503), 'unexpected', 'event'],
    ['응답 계약 위반 ParseError', new ParseError('invalid'), 'unexpected', 'event'],
    ['mapper가 던진 ZodError', new ZodError([]), 'unexpected', 'event'],
    ['코드 없이 감싼 SDK 오류', new ClipboardCopyError(new Error('sdk')), 'unexpected', 'event'],
    [
      '문자열 code를 지닌 SDK 오류',
      Object.assign(new Error('ExpoClipboard rejected'), { code: 'ERR_CLIPBOARD' }),
      'unexpected',
      'event',
    ],
    ['코드 버그 TypeError', new TypeError('x is not a function'), 'unexpected', 'event'],
    ['Error가 아닌 값', { message: 'native' }, 'unexpected', 'event'],
  ])('%s는 %s이고 %s로 남긴다', (_case, error, kind, report) => {
    // When
    const classification = classifyError(error);

    // Then
    expect(classification).toEqual({ kind, report });
  });
});
