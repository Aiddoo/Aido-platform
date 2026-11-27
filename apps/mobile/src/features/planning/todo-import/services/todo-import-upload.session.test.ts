import { ErrorCode } from '@aido/api/errors';
import { IDEMPOTENCY_KEY_HEADER, TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import type { ImportEventRecord } from '@src/core/ports/todo-import-source';
import { createSignOutEpoch } from '@src/core/session/sign-out-epoch';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { dateKeySchema } from '@src/shared/date/date-key';
import { NetworkError } from '@src/shared/errors/infra-error';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAppLoggerStub,
  createHttpClientStub,
  createIdGeneratorStub,
  createMemorySyncStorage,
  createTodoImportSourceStub,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { range } from 'es-toolkit';

import {
  createTodoImportApiError,
  createTodoImportDto,
  createTodoImportItem,
  createTodoImportSelection,
  IMPORT_ID,
  PERSONAL_COLLECTION_KEY,
} from '../__tests__/todo-import.fixtures';
import { toTodoImportItem } from '../apis/todo-import-item.mapper';
import { TodoImportApi } from '../apis/todo-import.api';
import { TODO_IMPORT_LOG_EVENT } from '../constants/todo-import-log-events';
import { TODO_IMPORT_MAX_RETRY_COUNT } from '../constants/todo-import.constants';
import {
  createTodoImportSession,
  TodoImportSessionPolicy,
} from '../domains/todo-import-session.model';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';
import {
  chunkItems,
  fingerprintItems,
  getRetryWait,
  TodoImportUploadSession,
} from './todo-import-upload.session';

const ACCOUNT_ID = 'user-1';
const UNTITLED = '제목 없는 일정';
const INPUT = { accountId: ACCOUNT_ID, untitledTitle: UNTITLED };
const START_PATH = 'v1/todo-imports';
const DETAIL_PATH = `v1/todo-imports/${IMPORT_ID}`;
const ITEMS_PATH = `${DETAIL_PATH}/items`;
const COMMIT_PATH = `${DETAIL_PATH}/commit`;

/** 서울 2026-11-24부터 하루에 하나씩 시각 일정. 150개면 묶음이 둘이다 */
function createEvents(count: number): ImportEventRecord[] {
  return range(count).map((index) => ({
    collectionKey: PERSONAL_COLLECTION_KEY,
    occurrenceKey: index.toString(16).padStart(64, '0'),
    title: `일정 ${index}`,
    time: {
      kind: 'timed',
      startsAt: `2026-11-24T0${index % 10}:00:00.000Z`,
      endsAt: `2026-11-24T0${index % 10}:30:00.000Z`,
    },
    isCanceled: false,
  }));
}

function respond(responses: Record<string, () => Promise<Result<unknown, ApiError>>>) {
  return async (url: string) => {
    const response = responses[url];
    if (response == null) {
      throw new Error(`응답을 정하지 않았습니다: ${url}`);
    }
    return response();
  };
}

/** 일정을 주지 않으면 stub 기본값(서울 11/25 10시 회의, 제목 없는 11/26 종일, 취소된 회차, 다른 캘린더 공휴일)이다 */
function setup({
  events,
  todayKey = '2026-11-24',
  random = () => 0,
}: { events?: ImportEventRecord[]; todayKey?: string; random?: () => number } = {}) {
  const httpClient = createHttpClientStub();
  const storage = createMemorySyncStorage();
  const source = createTodoImportSourceStub({
    permission: { status: 'granted', canAskAgain: true },
    ...(events == null ? {} : { events }),
  });
  const signOutEpoch = createSignOutEpoch();
  const logger = createAppLoggerStub();
  const uploading = createTodoImportDto();
  httpClient.get.mockImplementation(
    respond({ [DETAIL_PATH]: async () => ok({ todoImport: uploading }) }),
  );
  httpClient.post.mockImplementation(
    respond({
      [START_PATH]: async () => ok({ todoImport: uploading }),
      [ITEMS_PATH]: async () => ok({ acceptedCount: 1, receivedItemCount: 1 }),
      [COMMIT_PATH]: async () => ok({ todoImport: createTodoImportDto({ status: 'QUEUED' }) }),
    }),
  );
  const session = new TodoImportUploadSession({
    todoImportApi: new TodoImportApi(httpClient),
    source,
    storage,
    signOutEpoch,
    idGenerator: createIdGeneratorStub(),
    logger,
    getTodayKey: () => dateKeySchema.parse(todayKey),
    random,
  });
  const readSession = () => readStoredValue(storage, todoImportSessionStoredValue, ACCOUNT_ID);
  const postsTo = (path: string) => httpClient.post.mock.calls.filter(([url]) => url === path);

  return { httpClient, storage, source, signOutEpoch, logger, session, readSession, postsTo };
}

/** 이 기기가 시작까지 받은 가져오기. 지문은 같은 일정을 서울 시간대로 나눈 값이다 */
function storeStartedSession(
  storage: ReturnType<typeof setup>['storage'],
  {
    events,
    nextChunkIndex,
    fingerprintEvents = events,
  }: {
    events: ImportEventRecord[];
    nextChunkIndex: number;
    fingerprintEvents?: ImportEventRecord[];
  },
) {
  const chunks = chunkItems(
    fingerprintEvents.flatMap((record) => {
      const item = toTodoImportItem(record, {
        timezone: 'Asia/Seoul',
        timeMode: 'TIME',
        untitledTitle: UNTITLED,
      });
      return item == null ? [] : [item];
    }),
  );
  const session = {
    ...TodoImportSessionPolicy.withImportId(
      createTodoImportSession({
        idempotencyKey: 'stored-key',
        selection: createTodoImportSelection(),
        hasAdjustedRange: false,
      }),
      IMPORT_ID,
    ),
    fingerprint: fingerprintItems(chunks),
    chunkCount: chunks.length,
    nextChunkIndex,
  };
  writeStoredValue(storage, todoImportSessionStoredValue, session, ACCOUNT_ID);
}

describe('getRetryWait', () => {
  it.each([
    ['첫 재시도는 1초 안에서 고른다', 0, null, 0.5, { serverMs: 0, backoffMs: 500 }],
    ['시도마다 상한이 두 배다', 3, null, 0.5, { serverMs: 0, backoffMs: 4000 }],
    ['상한은 1분을 넘지 않는다', 10, null, 0.999, { serverMs: 0, backoffMs: 59_940 }],
    [
      '백오프가 Retry-After보다 짧으면 서버 시간만 기다린다',
      0,
      30_000,
      0.1,
      { serverMs: 30_000, backoffMs: 0 },
    ],
    ['난수가 0이어도 Retry-After만큼 기다린다', 5, 2000, 0, { serverMs: 2000, backoffMs: 0 }],
    [
      '백오프가 Retry-After보다 길면 서버 시간 뒤 남은 만큼만 더 기다린다',
      6,
      30_000,
      0.999,
      { serverMs: 30_000, backoffMs: 29_940 },
    ],
  ])('%s', (_case, attempt, retryAfterMs, randomValue, expected) => {
    // When
    const wait = getRetryWait({ attempt, retryAfterMs, random: () => randomValue });

    // Then
    expect(wait).toEqual(expected);
  });
});

describe('chunkItems', () => {
  it('같은 키는 한 번만, 가까운 날짜·시각 순으로 100개씩 나눈다', () => {
    // Given
    const items = range(TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK + 1).map((index) =>
      createTodoImportItem({
        sourceKey: String(index).padStart(4, '0'),
        startDate: dateKeySchema.parse(index === 0 ? '2026-12-01' : '2026-11-30'),
      }),
    );
    const duplicate = createTodoImportItem({ sourceKey: '0001' });

    // When
    const chunks = chunkItems([...items, duplicate]);

    // Then
    expect(chunks.map((chunk) => chunk.length)).toEqual([
      TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK,
      1,
    ]);
    expect(chunks.at(-1)?.[0]?.sourceKey).toBe('0000');
  });

  it('날짜가 같으면 종일(시각 없음)이 먼저이고 그다음 이른 시각이다', () => {
    // Given
    const evening = createTodoImportItem({ sourceKey: 'e', localTime: '19:00' });
    const allDay = createTodoImportItem({ sourceKey: 'd', localTime: null });
    const morning = createTodoImportItem({ sourceKey: 'm', localTime: '08:00' });

    // When
    const [chunk] = chunkItems([evening, allDay, morning]);

    // Then
    expect(chunk?.map((item) => item.sourceKey)).toEqual(['d', 'm', 'e']);
  });
});

describe('fingerprintItems', () => {
  it('다시 읽은 일정이 같으면 순서가 달라도 같은 지문이고, 하나라도 다르면 다른 지문이다', () => {
    // Given
    const first = createTodoImportItem({ sourceKey: '1'.repeat(64) });
    const second = createTodoImportItem({ sourceKey: '2'.repeat(64) });
    const other = createTodoImportItem({ sourceKey: '3'.repeat(64) });

    // When
    const original = fingerprintItems(chunkItems([first, second]));
    const reread = fingerprintItems(chunkItems([second, first]));
    const changed = fingerprintItems(chunkItems([first, other]));

    // Then
    expect(reread).toBe(original);
    expect(changed).not.toBe(original);
  });
});

describe('TodoImportUploadSession', () => {
  describe('start', () => {
    it('키를 먼저 저장하고 보낸 뒤, 일정을 올리고 확정하면 기기 상태를 지운다', async () => {
      // Given
      const { httpClient, session, readSession, postsTo } = setup();
      let storedKeyAtPost: string | null = null;
      httpClient.post.mockImplementationOnce(async () => {
        storedKeyAtPost = readSession()?.idempotencyKey ?? null;
        return ok({ todoImport: createTodoImportDto() });
      });

      // When
      const result = await session.start({ ...INPUT, selection: createTodoImportSelection() });
      await session.resume(INPUT);

      // Then
      expect(result.ok && result.value.todoImport.id).toBe(IMPORT_ID);
      expect(storedKeyAtPost).not.toBeNull();
      expect(postsTo(START_PATH)[0]?.[2]?.headers?.[IDEMPOTENCY_KEY_HEADER]).toBe(storedKeyAtPost);
      expect(postsTo(ITEMS_PATH)).toHaveLength(1);
      expect(postsTo(ITEMS_PATH)[0]?.[1]).toEqual({
        items: [
          expect.objectContaining({
            title: '팀 회의',
            startDate: '2026-11-25',
            localTime: '10:00',
          }),
          expect.objectContaining({ title: UNTITLED, startDate: '2026-11-26', endDate: null }),
        ],
      });
      expect(postsTo(COMMIT_PATH)).toHaveLength(1);
      expect(readSession()).toBeNull();
      expect(session.getSnapshot()).toEqual({ stage: 'idle' });
    });

    it('기기 자정과 서버 자정이 어긋나면 오늘부터로 기간을 맞춰 새 키로 한 번만 다시 보낸다', async () => {
      // Given
      const { httpClient, session, postsTo } = setup({ todayKey: '2026-11-25' });
      const startBeforeToday = createTodoImportApiError({
        code: ErrorCode.TODO_IMPORT_2306,
        details: { reason: 'START_BEFORE_TODAY' },
      });
      httpClient.post.mockResolvedValueOnce(fail(startBeforeToday));
      httpClient.post.mockResolvedValueOnce(fail(startBeforeToday));

      // When
      const result = await session.start({ ...INPUT, selection: createTodoImportSelection() });

      // Then
      const starts = postsTo(START_PATH);
      expect(starts).toHaveLength(2);
      expect(starts[1]?.[1]).toMatchObject({ startDate: '2026-11-25', endDate: '2026-12-23' });
      expect(starts[0]?.[2]?.headers?.[IDEMPOTENCY_KEY_HEADER]).not.toBe(
        starts[1]?.[2]?.headers?.[IDEMPOTENCY_KEY_HEADER],
      );
      expect(result.ok).toBe(false);
    });

    it('서버가 거절한 시작은 결과로 돌려주고 기기 상태를 남기지 않는다', async () => {
      // Given
      const { httpClient, session, readSession } = setup();
      httpClient.post.mockResolvedValueOnce(
        fail(
          createTodoImportApiError({
            code: ErrorCode.TODO_IMPORT_2301,
            details: { importId: IMPORT_ID },
          }),
        ),
      );

      // When
      const result = await session.start({ ...INPUT, selection: createTodoImportSelection() });

      // Then
      expect(result.ok ? null : result.error.code).toBe(ErrorCode.TODO_IMPORT_2301);
      expect(readSession()).toBeNull();
    });

    it('이 기기에서 올리던 가져오기가 있으면 새 시작이 그 상태를 지우지 않는다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, readSession, postsTo } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 1 });
      httpClient.post.mockResolvedValueOnce(
        fail(
          createTodoImportApiError({
            code: ErrorCode.TODO_IMPORT_2301,
            details: { importId: IMPORT_ID },
          }),
        ),
      );

      // When
      const result = await session.start({ ...INPUT, selection: createTodoImportSelection() });
      const afterStart = readSession();
      await session.resume(INPUT);

      // Then
      expect(result.ok ? null : result.error.code).toBe(ErrorCode.TODO_IMPORT_2301);
      expect(afterStart).toMatchObject({
        idempotencyKey: 'stored-key',
        importId: IMPORT_ID,
        nextChunkIndex: 1,
      });
      expect(postsTo(COMMIT_PATH)).toHaveLength(1);
    });

    it('남아 있던 업로드가 서버에서 이미 끝나 새 시작을 받으면 새 상태로 처음부터 올린다', async () => {
      // Given
      const events = createEvents(2);
      const { storage, session, postsTo } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 1 });

      // When
      const result = await session.start({ ...INPUT, selection: createTodoImportSelection() });
      await session.resume(INPUT);

      // Then
      expect(result.ok).toBe(true);
      expect(postsTo(ITEMS_PATH)).toHaveLength(1);
      expect(postsTo(COMMIT_PATH)).toHaveLength(1);
    });
  });

  describe('cancel', () => {
    it('cancel은 서버 취소 뒤 기기 상태를 지운다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, readSession } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.delete.mockResolvedValueOnce(
        ok({ todoImport: createTodoImportDto({ status: 'CANCELED' }) }),
      );

      // When
      const result = await session.cancel({ accountId: ACCOUNT_ID, importId: IMPORT_ID });

      // Then
      expect(result.ok && result.value.status).toBe('CANCELED');
      expect(readSession()).toBeNull();
      expect(session.getSnapshot()).toEqual({ stage: 'idle' });
    });

    it('서버가 멈춤을 받지 않으면 기기 상태를 남겨 이어 올릴 수 있다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, readSession } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.delete.mockResolvedValueOnce(
        fail(createTodoImportApiError({ code: ErrorCode.SYS_0001, status: 429 })),
      );

      // When
      const result = await session.cancel({ accountId: ACCOUNT_ID, importId: IMPORT_ID });

      // Then
      expect(result.ok).toBe(false);
      expect(readSession()?.importId).toBe(IMPORT_ID);
    });
  });

  describe('resume', () => {
    it('다시 읽은 일정이 같으면 끊긴 묶음부터 보낸다', async () => {
      // Given
      const events = createEvents(150);
      const { storage, session, postsTo } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 1 });

      // When
      await session.resume(INPUT);

      // Then
      expect(postsTo(ITEMS_PATH)).toHaveLength(1);
      expect(postsTo(COMMIT_PATH)).toHaveLength(1);
    });

    it('캘린더가 바뀌어 지문이 다르면 처음 묶음부터 다시 보낸다', async () => {
      // Given
      const events = createEvents(150);
      const { storage, session, postsTo } = setup({ events });
      storeStartedSession(storage, {
        events,
        nextChunkIndex: 1,
        fingerprintEvents: createEvents(149),
      });

      // When
      await session.resume(INPUT);

      // Then
      expect(postsTo(ITEMS_PATH)).toHaveLength(2);
    });

    it('동시에 여러 번 불러도 캘린더는 한 번만 읽는다', async () => {
      // Given
      const events = createEvents(2);
      const { storage, source, session } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });

      // When
      await Promise.all([session.resume(INPUT), session.resume(INPUT), session.resume(INPUT)]);

      // Then
      expect(source.readEvents).toHaveBeenCalledTimes(1);
    });

    it('속도 제한(429)은 Retry-After만큼 기다렸다 같은 묶음을 다시 보낸다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, postsTo } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.post.mockResolvedValueOnce(
        fail(createTodoImportApiError({ code: ErrorCode.SYS_0001, status: 429, retryAfterMs: 0 })),
      );

      // When
      await session.resume(INPUT);

      // Then
      expect(postsTo(ITEMS_PATH)).toHaveLength(2);
      expect(postsTo(COMMIT_PATH)).toHaveLength(1);
    });

    it(`연결이 ${TODO_IMPORT_MAX_RETRY_COUNT}번 넘게 끊기면 멈추고 이어 보낼 상태를 남긴다`, async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, postsTo, readSession } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.post.mockRejectedValue(new NetworkError());

      // When
      await session.resume(INPUT);

      // Then
      expect(postsTo(ITEMS_PATH)).toHaveLength(TODO_IMPORT_MAX_RETRY_COUNT + 1);
      expect(session.getSnapshot()).toEqual({
        stage: 'paused',
        importId: IMPORT_ID,
        reason: 'interrupted',
      });
      expect(readSession()?.nextChunkIndex).toBe(0);
    });

    it('올리는 사이 로그아웃하면 지운 계정 저장소에 다시 쓰지 않고 확정하지 않는다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, signOutEpoch, session, postsTo } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      const upload = Promise.withResolvers<Result<unknown, ApiError>>();
      const posted = Promise.withResolvers<void>();
      httpClient.post.mockImplementationOnce(() => {
        posted.resolve();
        return upload.promise;
      });

      // When
      const resuming = session.resume(INPUT);
      await posted.promise;
      storage.clear();
      signOutEpoch.advance();
      upload.resolve(ok({ acceptedCount: 2, receivedItemCount: 2 }));
      await resuming;

      // Then
      expect(storage.keys()).toEqual([]);
      expect(postsTo(COMMIT_PATH)).toHaveLength(0);
    });

    it('캘린더 권한이 없으면 권한 이유로 멈춘다', async () => {
      // Given
      const events = createEvents(2);
      const { storage, source, session, readSession, postsTo } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      source.getPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });

      // When
      await session.resume(INPUT);

      // Then
      expect(session.getSnapshot()).toEqual({
        stage: 'paused',
        importId: IMPORT_ID,
        reason: 'permission',
      });
      expect(source.readEvents).not.toHaveBeenCalled();
      expect(postsTo(ITEMS_PATH)).toHaveLength(0);
      expect(readSession()?.importId).toBe(IMPORT_ID);
    });

    it('시작 응답 전에 꺼진 가져오기를 다음 날 이어 가면 기간을 오늘부터로 한 번 맞춰 새 키로 보낸다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, postsTo } = setup({ events, todayKey: '2026-11-25' });
      writeStoredValue(
        storage,
        todoImportSessionStoredValue,
        createTodoImportSession({
          idempotencyKey: 'stored-key',
          selection: createTodoImportSelection(),
          hasAdjustedRange: false,
        }),
        ACCOUNT_ID,
      );
      httpClient.post.mockResolvedValueOnce(
        fail(
          createTodoImportApiError({
            code: ErrorCode.TODO_IMPORT_2306,
            details: { reason: 'START_BEFORE_TODAY' },
          }),
        ),
      );

      // When
      await session.resume(INPUT);

      // Then
      const starts = postsTo(START_PATH);
      expect(starts).toHaveLength(2);
      expect(starts[0]?.[2]?.headers?.[IDEMPOTENCY_KEY_HEADER]).toBe('stored-key');
      expect(starts[1]?.[1]).toMatchObject({ startDate: '2026-11-25' });
      expect(starts[1]?.[2]?.headers?.[IDEMPOTENCY_KEY_HEADER]).not.toBe('stored-key');
      expect(postsTo(COMMIT_PATH)).toHaveLength(1);
    });

    it('서버에 없는 가져오기(404)는 기기 상태를 지운다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, readSession } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.get.mockResolvedValueOnce(
        fail(
          createTodoImportApiError({
            code: ErrorCode.TODO_IMPORT_2304,
            details: { importId: IMPORT_ID },
          }),
        ),
      );

      // When
      await session.resume(INPUT);

      // Then
      expect(readSession()).toBeNull();
      expect(session.getSnapshot()).toEqual({ stage: 'idle' });
    });

    it('서버가 받지 않은 가져오기를 멈추지 못하면 경고를 한 번 남기고 이유는 그대로 보인다', async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, logger, session } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.post.mockResolvedValueOnce(
        fail(createTodoImportApiError({ code: ErrorCode.TODO_IMPORT_2309 })),
      );
      httpClient.delete.mockRejectedValue(new NetworkError());

      // When
      await session.resume(INPUT);

      // Then
      expect(session.getSnapshot()).toMatchObject({ stage: 'failed', importId: IMPORT_ID });
      const cancelWarnings = logger.warn.mock.calls.filter(
        ([event]) => event === TODO_IMPORT_LOG_EVENT.UPLOAD_CANCEL_FAILED,
      );
      expect(cancelWarnings).toEqual([
        [TODO_IMPORT_LOG_EVENT.UPLOAD_CANCEL_FAILED, { errorName: 'NetworkError' }],
      ]);
    });

    describe('재시도 대기', () => {
      setupFakeTimersPerTest();

      const RETRY_AFTER_MS = 30 * SECOND_MS;
      // 난수 0.999면 백오프가 그 시도의 상한(1초, 2초, …, 6번째는 32초)에 거의 닿는다
      const NEARLY_FULL_BACKOFF = () => 0.999;

      function setupStartedUpload() {
        const events = createEvents(2);
        const context = setup({ events, random: NEARLY_FULL_BACKOFF });
        storeStartedSession(context.storage, { events, nextChunkIndex: 0 });
        return context;
      }

      function failWithRateLimit() {
        return fail(
          createTodoImportApiError({
            code: ErrorCode.SYS_0001,
            status: 429,
            retryAfterMs: RETRY_AFTER_MS,
          }),
        );
      }

      it('백오프를 기다리는 사이 다시 부르면(온라인 복귀) 남은 대기를 건너뛰고 바로 다시 보낸다', async () => {
        // Given
        const { httpClient, session, postsTo } = setupStartedUpload();
        httpClient.post.mockRejectedValueOnce(new NetworkError());
        const waiting = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(1);
        expect(postsTo(ITEMS_PATH)).toHaveLength(1);

        // When
        const resumed = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(1);

        // Then
        expect(postsTo(ITEMS_PATH)).toHaveLength(2);
        await Promise.all([waiting, resumed]);
        expect(postsTo(COMMIT_PATH)).toHaveLength(1);
      });

      it('서버가 정한 Retry-After 동안에는 다시 불러도 보내지 않고, 그 시간이 지나면 남은 백오프 없이 바로 보낸다', async () => {
        // Given
        // 여섯 번째 대기는 서버 시간 30초 뒤에 백오프가 2초쯤 더 남는다
        const { httpClient, session, postsTo } = setupStartedUpload();
        for (const _attempt of range(6)) {
          httpClient.post.mockResolvedValueOnce(failWithRateLimit());
        }
        const waiting = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(1);
        for (const _attempt of range(5)) {
          await jest.advanceTimersByTimeAsync(RETRY_AFTER_MS + SECOND_MS / 10);
        }
        expect(postsTo(ITEMS_PATH)).toHaveLength(6);

        // When
        const resumed = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(RETRY_AFTER_MS - SECOND_MS);
        const postCountBeforeRetryAfter = postsTo(ITEMS_PATH).length;
        await jest.advanceTimersByTimeAsync(SECOND_MS + SECOND_MS / 2);

        // Then
        expect(postCountBeforeRetryAfter).toBe(6);
        expect(postsTo(ITEMS_PATH)).toHaveLength(7);
        await Promise.all([waiting, resumed]);
        expect(postsTo(COMMIT_PATH)).toHaveLength(1);
      });

      it('다시 부르지 않으면 Retry-After가 지난 뒤에야 다시 보낸다', async () => {
        // Given
        const { httpClient, session, postsTo } = setupStartedUpload();
        httpClient.post.mockResolvedValueOnce(failWithRateLimit());
        const waiting = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(1);

        // When
        await jest.advanceTimersByTimeAsync(RETRY_AFTER_MS - SECOND_MS);
        const postCountBeforeRetryAfter = postsTo(ITEMS_PATH).length;
        await jest.advanceTimersByTimeAsync(SECOND_MS);
        await waiting;

        // Then
        expect(postCountBeforeRetryAfter).toBe(1);
        expect(postsTo(ITEMS_PATH)).toHaveLength(2);
      });

      it('기다리는 사이 놓으면 더 보내지 않는다', async () => {
        // Given
        const { httpClient, session, postsTo } = setupStartedUpload();
        httpClient.post.mockResolvedValueOnce(failWithRateLimit());
        const waiting = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(1);

        // When
        session.dispose();
        await jest.advanceTimersByTimeAsync(RETRY_AFTER_MS + MINUTE_MS);
        await waiting;

        // Then
        expect(postsTo(ITEMS_PATH)).toHaveLength(1);
        expect(postsTo(COMMIT_PATH)).toHaveLength(0);
      });

      it('깨워서 보낸 시도는 재시도 횟수에 넣지 않아, 여러 번 깨워도 정해진 횟수를 다 쓴 뒤에 멈춘다', async () => {
        // Given
        const wakeCount = 3;
        const { httpClient, session, postsTo, readSession } = setupStartedUpload();
        httpClient.post.mockRejectedValue(new NetworkError());
        const waiting = session.resume(INPUT);
        await jest.advanceTimersByTimeAsync(1);

        // When
        for (const _wake of range(wakeCount)) {
          session.resume(INPUT);
          await jest.advanceTimersByTimeAsync(1);
        }
        const postCountAfterWakes = postsTo(ITEMS_PATH).length;
        await jest.advanceTimersByTimeAsync(TODO_IMPORT_MAX_RETRY_COUNT * MINUTE_MS);
        await waiting;

        // Then
        expect(postCountAfterWakes).toBe(1 + wakeCount);
        expect(postsTo(ITEMS_PATH)).toHaveLength(TODO_IMPORT_MAX_RETRY_COUNT + 1 + wakeCount);
        expect(session.getSnapshot()).toEqual({
          stage: 'paused',
          importId: IMPORT_ID,
          reason: 'interrupted',
        });
        expect(readSession()?.nextChunkIndex).toBe(0);
      });
    });
  });
});
