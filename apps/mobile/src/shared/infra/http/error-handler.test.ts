import { ErrorCode } from '@aido/errors';
import { isApiError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import type { AfterResponseState, KyRequest, KyResponse, NormalizedOptions } from 'ky';
import { handlePublicApiErrors } from './error-handler';

const createErrorResponse = (code: string, message: string, status = 400): Response =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const runHook = async (response: Response): Promise<unknown> => {
  const request = new Request('https://api.test/todos') as KyRequest;
  try {
    await handlePublicApiErrors(
      request,
      {} as NormalizedOptions,
      response as KyResponse,
      { retryCount: 0 } as AfterResponseState,
    );
    return null;
  } catch (error) {
    return error;
  }
};

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('resolveMessage (handlePublicApiErrors 경유)', () => {
  it('알려진 에러 코드는 ko 카탈로그 문구로 번역한다', async () => {
    // Given
    const response = createErrorResponse(ErrorCode.TODO_0801, '서버의 포멀한 메시지');

    // When
    const error = await runHook(response);

    // Then
    expect(isApiError(error)).toBe(true);
    if (isApiError(error)) {
      expect(error.message).toBe('할 일을 찾을 수 없어요');
    }
  });

  it('언어가 en이면 같은 코드가 영어 문구로 번역된다', async () => {
    // Given
    await i18n.changeLanguage('en');
    const response = createErrorResponse(ErrorCode.TODO_0801, '서버의 포멀한 메시지');

    // When
    const error = await runHook(response);

    // Then
    if (isApiError(error)) {
      expect(error.message).toBe('To-do not found');
    }
  });

  it('보안 마스킹 그룹(EMAIL_0502/0507)은 두 언어 모두 동일 문구를 사용한다', async () => {
    // Given / When
    const error502ko = await runHook(createErrorResponse(ErrorCode.EMAIL_0502, ''));
    const error507ko = await runHook(createErrorResponse(ErrorCode.EMAIL_0507, ''));

    await i18n.changeLanguage('en');
    const error502en = await runHook(createErrorResponse(ErrorCode.EMAIL_0502, ''));
    const error507en = await runHook(createErrorResponse(ErrorCode.EMAIL_0507, ''));

    // Then
    if (isApiError(error502ko) && isApiError(error507ko)) {
      expect(error502ko.message).toBe(error507ko.message);
    }
    if (isApiError(error502en) && isApiError(error507en)) {
      expect(error502en.message).toBe(error507en.message);
    }
  });

  it('카탈로그에 없는 코드는 서버 메시지를 그대로 사용한다', async () => {
    // Given — MEMO 등 카탈로그 미등재 코드 시뮬레이션
    const response = createErrorResponse('UNKNOWN_9999', '서버가 내려준 메시지');

    // When
    const error = await runHook(response);

    // Then
    if (isApiError(error)) {
      expect(error.message).toBe('서버가 내려준 메시지');
    }
  });

  it('서버 메시지도 없으면 로케일 폴백 문구를 사용한다', async () => {
    // Given
    const response = createErrorResponse('UNKNOWN_9999', '');

    // When
    const error = await runHook(response);

    // Then
    if (isApiError(error)) {
      expect(error.message).toBe('알 수 없는 오류가 발생했어요');
    }
  });

  it('본문이 JSON이 아니면 SYS_0001로 처리한다', async () => {
    // Given
    const response = new Response('Internal Server Error', { status: 500 });

    // When
    const error = await runHook(response);

    // Then
    if (isApiError(error)) {
      expect(error.code).toBe(ErrorCode.SYS_0001);
      expect(error.message).toBe('서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    }
  });
});
