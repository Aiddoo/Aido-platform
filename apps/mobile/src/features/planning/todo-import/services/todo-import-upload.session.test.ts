import { ErrorCode } from '@aido/api/errors';
import { IDEMPOTENCY_KEY_HEADER } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import type { ImportEventRecord } from '@src/core/ports/todo-import-source';
import { createSignOutEpoch } from '@src/core/session/sign-out-epoch';
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
import { range } from 'es-toolkit';

import {
  createTodoImportApiError,
  createTodoImportDto,
  createTodoImportSelection,
  IMPORT_ID,
  PERSONAL_COLLECTION_KEY,
} from '../__tests__/todo-import.fixtures';
import { toImportItem } from '../apis/todo-import-item.mapper';
import { TodoImportApi } from '../apis/todo-import.api';
import { TODO_IMPORT_MAX_RETRIES } from '../constants/todo-import.constants';
import { chunkItems, fingerprintItems } from '../domains/todo-import-item.model';
import {
  createTodoImportSession,
  TodoImportSessionPolicy,
} from '../domains/todo-import-session.model';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';
import { TodoImportUploadSession } from './todo-import-upload.session';

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
}: { events?: ImportEventRecord[]; todayKey?: string } = {}) {
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
    random: () => 0,
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
      const item = toImportItem(record, {
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

    it(`연결이 ${TODO_IMPORT_MAX_RETRIES}번 넘게 끊기면 멈추고 이어 보낼 상태를 남긴다`, async () => {
      // Given
      const events = createEvents(2);
      const { httpClient, storage, session, postsTo, readSession } = setup({ events });
      storeStartedSession(storage, { events, nextChunkIndex: 0 });
      httpClient.post.mockRejectedValue(new NetworkError());

      // When
      await session.resume(INPUT);

      // Then
      expect(postsTo(ITEMS_PATH)).toHaveLength(TODO_IMPORT_MAX_RETRIES + 1);
      expect(session.getSnapshot()).toEqual({ stage: 'paused', importId: IMPORT_ID });
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
  });
});
