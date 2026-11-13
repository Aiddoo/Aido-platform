import { ErrorCode } from '@aido/api/errors';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createErrorReporterStub, runKyAfterResponseHook } from '@src/testing/core';

import {
  createApiFailureBreadcrumbHook,
  createPublicApiFailureBreadcrumbHook,
} from './api-failure-breadcrumb';

const createErrorResponse = (code: string, message: string, status = 400): Response =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Hook = ReturnType<typeof createPublicApiFailureBreadcrumbHook>;

const runHook = async (hook: Hook, response: Response): Promise<void> => {
  await runKyAfterResponseHook(hook, new Request('https://api.test/todos'), response);
};

describe('실패 응답 관측 훅 (분류·throw는 KyHttpClient의 몫)', () => {
  let addBreadcrumb: jest.Mocked<ErrorReporter>['addBreadcrumb'];
  let recordPublicApiFailureBreadcrumb: Hook;
  let recordApiFailureBreadcrumb: Hook;

  beforeEach(() => {
    const errorReporter = createErrorReporterStub();
    addBreadcrumb = errorReporter.addBreadcrumb;
    recordPublicApiFailureBreadcrumb = createPublicApiFailureBreadcrumbHook(errorReporter);
    recordApiFailureBreadcrumb = createApiFailureBreadcrumbHook(errorReporter);
  });

  it('실패 응답은 throw 없이 status와 서버 코드를 담은 breadcrumb만 남긴다', async () => {
    // Given
    const response = createErrorResponse(ErrorCode.TODO_0801, '할 일 없음', 404);

    // When
    const result = runHook(recordPublicApiFailureBreadcrumb, response);

    // Then
    // 훅은 절대 throw하지 않는다
    await expect(result).resolves.toBeUndefined();
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

    // When
    const result = runHook(recordPublicApiFailureBreadcrumb, response);

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 502, code: ErrorCode.SYS_0001 }),
      }),
    );
  });

  it('요청 ID를 breadcrumb에 남겨 서버 로그·Sentry 이벤트와 잇는다', async () => {
    // Given
    const request = new Request('https://api.test/todos', {
      headers: { 'X-Request-Id': '3f2b8c1e-5d4a-4b6f-9e2d-1a7c8b9d0e1f' },
    });
    const response = createErrorResponse(ErrorCode.TODO_0801, '할 일 없음', 404);

    // When
    await runKyAfterResponseHook(recordPublicApiFailureBreadcrumb, request, response);

    // Then
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestId: '3f2b8c1e-5d4a-4b6f-9e2d-1a7c8b9d0e1f' }),
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
    // Given
    // 401 처리는 token-refresh-hook의 책임
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
