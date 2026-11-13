import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

import { scrubBreadcrumb, scrubContext, scrubSentryEvent, scrubText } from './scrub-sentry-event';

describe('scrubContext', () => {
  it('허용된 키의 원시값만 남긴다', () => {
    // When
    const result = scrubContext({ memoId: 7, status: 500, code: 'MEMO_1', durationMs: 120 });

    // Then
    expect(result).toEqual({ memoId: 7, status: 500, code: 'MEMO_1', durationMs: 120 });
  });

  it.each(['content', 'transcript', 'title', 'body', 'text', 'email', 'accessToken', 'query'])(
    '허용 목록에 없는 키 %s는 값과 함께 지운다',
    (key) => {
      // When
      const result = scrubContext({ [key]: '내일 병원 가기', status: 200 });

      // Then
      expect(result).toEqual({ status: 200 });
    },
  );

  it.each([
    {
      scenario: '날짜 바뀜',
      data: { previousDate: '2026-11-11', nextDate: '2026-11-12', trigger: 'foreground' },
    },
    {
      scenario: '말하기',
      data: { mode: 'quick', locale: 'ko-KR', on_device: true, duration_bucket: '10-30s' },
    },
    {
      scenario: '위젯 동기화',
      data: { date: '2026-11-12', state: 'ready', total: 3, dayCount: 7 },
    },
    {
      scenario: '푸시 payload',
      data: { source: 'response', droppedPaths: 'data.todoId', isReadable: false },
    },
  ])('$scenario breadcrumb의 키는 그대로 남긴다', ({ data }) => {
    // When
    const result = scrubContext(data);

    // Then
    expect(result).toEqual(data);
  });

  it('허용된 키라도 객체와 배열 값은 지운다', () => {
    // When
    const result = scrubContext({ error: { message: '메모 본문' }, reason: ['a'], step: 'play' });

    // Then
    expect(result).toEqual({ step: 'play' });
  });

  it('허용된 키의 문자열에서도 이메일과 토큰을 가린다', () => {
    // When
    const result = scrubContext({
      error: 'user a@b.com failed with Bearer abc.def and eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl',
    });

    // Then
    expect(result).toEqual({ error: 'user [email] failed with Bearer [token] and [token]' });
  });

  it('url은 쿼리와 해시를 지운다', () => {
    // When
    const result = scrubContext({ url: 'https://api.example.com/v1/memos?token=secret#x' });

    // Then
    expect(result).toEqual({ url: 'https://api.example.com/v1/memos' });
  });
});

describe('scrubText', () => {
  it('요청 ID 같은 UUID는 가리지 않는다', () => {
    // Given
    const uuid = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c';

    // When
    const result = scrubText(uuid);

    // Then
    expect(result).toBe(uuid);
  });

  it('긴 임의 토큰 문자열을 가린다', () => {
    // When
    const result = scrubText(`refresh ${'a1B2'.repeat(12)} end`);

    // Then
    expect(result).toBe('refresh [token] end');
  });
});

describe('scrubBreadcrumb', () => {
  it('console 카테고리는 버린다', () => {
    // When
    const result = scrubBreadcrumb({ category: 'console', message: '메모 본문' });

    // Then
    expect(result).toBeNull();
  });

  it('data는 허용 목록으로, message는 패턴으로 걸러 남긴다', () => {
    // Given
    const breadcrumb: Breadcrumb = {
      category: 'http',
      message: 'a@b.com 요청 실패',
      data: { status: 500, requestBody: '내일 병원 가기' },
    };

    // When
    const result = scrubBreadcrumb(breadcrumb);

    // Then
    expect(result).toEqual({
      category: 'http',
      message: '[email] 요청 실패',
      data: { status: 500 },
    });
  });
});

describe('scrubSentryEvent', () => {
  it('extra·예외 메시지·breadcrumb·요청·사용자에서 개인정보를 지운다', () => {
    // Given
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: 'failed for a@b.com' }] },
      extra: { loggerMessage: 'memo.save.failed', content: '병원 예약', status: 500 },
      breadcrumbs: [
        { category: 'console', message: '병원 예약' },
        { category: 'http', data: { status: 500, body: '병원 예약' } },
      ],
      request: {
        url: 'https://api.example.com/v1/memos?token=secret',
        method: 'POST',
        data: '병원 예약',
        cookies: { sid: 'x' },
        headers: { Authorization: 'Bearer abc', 'X-Request-Id': 'req-1' },
      },
      user: { id: '42', email: 'a@b.com', ip_address: '1.1.1.1' },
    };

    // When
    const result = scrubSentryEvent(event);

    // Then
    expect(result.exception?.values?.[0]?.value).toBe('failed for [email]');
    expect(result.extra).toEqual({ loggerMessage: 'memo.save.failed', status: 500 });
    expect(result.breadcrumbs).toEqual([{ category: 'http', data: { status: 500 } }]);
    expect(result.request).toEqual({
      url: 'https://api.example.com/v1/memos',
      method: 'POST',
      headers: { 'X-Request-Id': 'req-1' },
    });
    expect(result.user).toEqual({ id: '42' });
  });
});
