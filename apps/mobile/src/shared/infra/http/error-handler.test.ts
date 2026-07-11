import { ErrorCode } from '@aido/errors';
import { i18n } from '@src/shared/i18n';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import type { AfterResponseState, KyRequest, KyResponse, NormalizedOptions } from 'ky';
import {
  recordApiFailureBreadcrumb,
  recordPublicApiFailureBreadcrumb,
  resolveMessage,
} from './error-handler';

const createErrorResponse = (code: string, message: string, status = 400): Response =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Hook = typeof recordPublicApiFailureBreadcrumb;

const runHook = async (hook: Hook, response: Response): Promise<void> => {
  const request = new Request('https://api.test/todos') as KyRequest;
  await hook(
    request,
    {} as NormalizedOptions,
    response as KyResponse,
    {
      retryCount: 0,
    } as AfterResponseState,
  );
};

describe('실패 응답 관측 훅 (분류·throw는 KyHttpClient의 몫)', () => {
  let addBreadcrumb: jest.SpyInstance;

  beforeEach(() => {
    addBreadcrumb = jest.spyOn(errorReporter, 'addBreadcrumb').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('실패 응답은 throw 없이 breadcrumb만 남긴다 (status·서버 코드 포함)', async () => {
    // Given
    const response = createErrorResponse(ErrorCode.TODO_0801, '할 일 없음', 404);

    // When / Then — 훅은 절대 throw하지 않는다
    await expect(runHook(recordPublicApiFailureBreadcrumb, response)).resolves.toBeUndefined();
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'http',
        data: expect.objectContaining({ status: 404, code: ErrorCode.TODO_0801 }),
      }),
    );
  });

  it('본문이 JSON이 아니면(프록시 5xx 등) SYS_0001로 breadcrumb를 남긴다', async () => {
    // Given
    const response = new Response('Bad Gateway', { status: 502 });

    // When / Then
    await expect(runHook(recordPublicApiFailureBreadcrumb, response)).resolves.toBeUndefined();
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 502, code: ErrorCode.SYS_0001 }),
      }),
    );
  });

  it('성공 응답에는 breadcrumb를 남기지 않는다', async () => {
    // Given
    const response = new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });

    // When
    await runHook(recordPublicApiFailureBreadcrumb, response);

    // Then
    expect(addBreadcrumb).not.toHaveBeenCalled();
  });

  it('auth 훅은 401을 건너뛴다 (갱신 흐름의 소음 방지)', async () => {
    // Given — 401 처리는 token-refresh-hook의 책임
    const response = createErrorResponse('AUTH_0102', 'expired', 401);

    // When
    await runHook(recordApiFailureBreadcrumb, response);

    // Then
    expect(addBreadcrumb).not.toHaveBeenCalled();
  });

  it('auth 훅도 401 외 실패에는 breadcrumb를 남긴다', async () => {
    // Given
    const response = createErrorResponse(ErrorCode.SYS_0001, '서버 오류', 500);

    // When
    await runHook(recordApiFailureBreadcrumb, response);

    // Then
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 500, code: ErrorCode.SYS_0001 }),
      }),
    );
  });

  it('public 훅은 401에도 breadcrumb를 남긴다 (공개 API에는 갱신 흐름이 없다)', async () => {
    // Given
    const response = createErrorResponse('AUTH_0201', '로그인 실패', 401);

    // When
    await runHook(recordPublicApiFailureBreadcrumb, response);

    // Then
    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
  });
});

describe('resolveMessage (KyHttpClient의 4xx → ApiError 분기에서 사용)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('알려진 코드는 서버 메시지 대신 카탈로그 문구를 사용한다', () => {
    expect(resolveMessage('TODO_0801', '서버의 포멀한 메시지')).toBe('할 일을 찾을 수 없어요');
  });

  it('en에서는 같은 코드가 영어 문구로 번역된다', async () => {
    await i18n.changeLanguage('en');
    expect(resolveMessage('TODO_0801', '서버의 포멀한 메시지')).toBe('To-do not found');
  });

  it('보안 마스킹 그룹(EMAIL_0502/0507)은 두 언어 모두 동일 문구를 사용한다', async () => {
    expect(resolveMessage(ErrorCode.EMAIL_0502, '')).toBe(resolveMessage(ErrorCode.EMAIL_0507, ''));

    await i18n.changeLanguage('en');
    expect(resolveMessage(ErrorCode.EMAIL_0502, '')).toBe(resolveMessage(ErrorCode.EMAIL_0507, ''));
  });

  it('미지 코드는 서버 메시지, 그것도 없으면 폴백을 사용한다', () => {
    expect(resolveMessage('UNKNOWN_9999', '서버가 내려준 메시지')).toBe('서버가 내려준 메시지');
    expect(resolveMessage('UNKNOWN_9999', '')).toBe('알 수 없는 오류가 발생했어요');
  });
});
