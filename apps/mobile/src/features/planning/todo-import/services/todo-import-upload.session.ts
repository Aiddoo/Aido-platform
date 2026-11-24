import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result, unwrap } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { TodoImportSource } from '@src/core/ports/todo-import-source';
import type { SignOutEpoch } from '@src/core/session/sign-out-epoch';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { getStartOfDateKey } from '@src/shared/date/zoned';
import { getErrorMessage, toError } from '@src/shared/errors';
import {
  readStoredValue,
  removeStoredValue,
  writeStoredValue,
} from '@src/shared/storage/define-stored-value';
import { compact, delay, noop, retry } from 'es-toolkit';

import { toImportItem } from '../apis/todo-import-item.mapper';
import type { TodoImportApi } from '../apis/todo-import.api';
import { TODO_IMPORT_LOG_EVENT } from '../constants/todo-import-log-events';
import { TODO_IMPORT_MAX_RETRIES } from '../constants/todo-import.constants';
import { chunkItems, filterByRange, fingerprintItems } from '../domains/todo-import-item.model';
import {
  adjustSelectionToToday,
  createTodoImportSession,
  getRetryDelayMs,
  type TodoImportSelection,
  type TodoImportSession,
  TodoImportSessionPolicy,
} from '../domains/todo-import-session.model';
import {
  findRetryAfterMs,
  findTodoImportRejectionCode,
  isRetryableTodoImportError,
  isStartBeforeTodayError,
  isTodoImportNotFoundError,
  isTodoImportStatusConflictError,
} from '../domains/todo-import.error';
import type { TodoImport } from '../domains/todo-import.model';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';

/** 서버 잡의 진행은 가져오기 조회가 따로 보인다 */
export type TodoImportUploadSnapshot =
  | { stage: 'idle' }
  | { stage: 'starting' }
  | { stage: 'reading'; importId: string }
  | { stage: 'uploading'; importId: string; uploadedChunkCount: number; chunkCount: number }
  | { stage: 'committing'; importId: string }
  | { stage: 'paused'; importId: string | null }
  | { stage: 'failed'; importId: string | null; code: string };

export interface StartedTodoImport {
  todoImport: TodoImport;
  /** 기기 자정과 서버 자정이 어긋나 오늘부터로 기간을 다시 맞췄다 */
  isRangeAdjusted: boolean;
}

interface TodoImportUploadInput {
  accountId: string;
  untitledTitle: string;
}

interface TodoImportUploadSessionPorts {
  todoImportApi: Pick<
    TodoImportApi,
    'startImport' | 'getImport' | 'uploadItems' | 'commitImport' | 'cancelImport'
  >;
  source: Pick<TodoImportSource, 'readEvents'>;
  storage: SyncStorage;
  signOutEpoch: Pick<SignOutEpoch, 'current'>;
  idGenerator: IdGenerator;
  logger: AppLogger;
  /** 기기 시간대의 오늘. 자정 경계 거절 뒤 기간을 다시 맞출 때만 읽는다 */
  getTodayKey: () => DateKey;
  random: () => number;
}

interface RunContext extends TodoImportUploadInput {
  signal: AbortSignal;
  isCurrent: () => boolean;
}

const IDLE_SNAPSHOT: TodoImportUploadSnapshot = { stage: 'idle' };

/**
 * 고른 일정을 읽어 100개씩 차례로 올리고 확정한다. 앱이 꺼지거나 연결이 끊겨도 계정 저장소의 상태로 이어 간다.
 * 실행은 하나씩만 돌고, 새로 시작하거나 놓으면 앞 실행을 멈춘다. 로그아웃 뒤에는 저장소에 쓰지 않는다
 */
export class TodoImportUploadSession {
  readonly #ports: TodoImportUploadSessionPorts;
  readonly #listeners = new Set<() => void>();
  #snapshot: TodoImportUploadSnapshot = IDLE_SNAPSHOT;
  #pending: Promise<void> = Promise.resolve();
  #generation = 0;
  #isRunning = false;
  #controller: AbortController | null = null;

  constructor(ports: TodoImportUploadSessionPorts) {
    this.#ports = ports;
  }

  getSnapshot = (): TodoImportUploadSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /**
   * 키를 먼저 저장하고 시작을 보낸다. 서버가 받으면 업로드를 이어서 돌리고 바로 돌려준다.
   * 4xx는 결과로 돌려주고 연결·서버 오류는 던진다(누른 화면이 알린다)
   */
  start = async ({
    accountId,
    untitledTitle,
    selection,
  }: TodoImportUploadInput & { selection: TodoImportSelection }): Promise<
    Result<StartedTodoImport, ApiError>
  > => {
    this.#stopRun();
    const generation = this.#generation;
    const epoch = this.#ports.signOutEpoch.current();
    const isCurrent = () =>
      generation === this.#generation && epoch === this.#ports.signOutEpoch.current();
    this.#emit({ stage: 'starting' });

    try {
      const result = await this.#postStart(
        accountId,
        createTodoImportSession({
          idempotencyKey: this.#ports.idGenerator.create(),
          selection,
          hasAdjustedRange: false,
        }),
        isCurrent,
      );
      if (!result.ok) {
        this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
        return result;
      }
      if (isCurrent()) {
        this.#schedule({ accountId, untitledTitle }, generation);
      }
      return result;
    } catch (error) {
      // 누른 화면이 연결 오류를 알리고 사용자가 다시 누른다. 남겨 두면 나중에 모르는 가져오기가 시작된다
      if (isCurrent()) {
        this.#clear(accountId, isCurrent);
      }
      this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
      throw error;
    }
  };

  /** 돌고 있으면 새로 돌리지 않고 그 실행을 기다린다 */
  resume = (input: TodoImportUploadInput): Promise<void> =>
    this.#isRunning ? this.#pending : this.#schedule(input, this.#generation);

  /** 실행을 멈추고 구독을 푼다. 저장한 상태는 남아 다음 resume이 이어 간다 */
  dispose = (): void => {
    this.#stopRun();
    this.#listeners.clear();
    this.#snapshot = IDLE_SNAPSHOT;
  };

  #stopRun = () => {
    this.#generation += 1;
    this.#controller?.abort();
    this.#controller = null;
  };

  #postStart = async (
    accountId: string,
    session: TodoImportSession,
    isCurrent: () => boolean,
  ): Promise<Result<StartedTodoImport, ApiError>> => {
    this.#save(accountId, session, isCurrent);
    const result = await this.#ports.todoImportApi.startImport(
      session.selection,
      session.idempotencyKey,
    );
    if (!isCurrent()) {
      return result.ok ? ok({ todoImport: result.value, isRangeAdjusted: false }) : result;
    }
    if (!result.ok) {
      const adjusted = session.hasAdjustedRange
        ? null
        : this.#adjustToTodayIfNeeded(result.error, session.selection);
      if (adjusted != null) {
        return this.#postStart(
          accountId,
          createTodoImportSession({
            idempotencyKey: this.#ports.idGenerator.create(),
            selection: adjusted,
            hasAdjustedRange: true,
          }),
          isCurrent,
        );
      }
      this.#clear(accountId, isCurrent);
      return result;
    }
    this.#save(
      accountId,
      TodoImportSessionPolicy.withImportId(session, result.value.id),
      isCurrent,
    );
    return ok({ todoImport: result.value, isRangeAdjusted: session.hasAdjustedRange });
  };

  #adjustToTodayIfNeeded = (
    error: ApiError,
    selection: TodoImportSelection,
  ): TodoImportSelection | null =>
    isStartBeforeTodayError(error)
      ? adjustSelectionToToday(selection, this.#ports.getTodayKey())
      : null;

  #schedule = (input: TodoImportUploadInput, generation: number): Promise<void> => {
    const run = this.#pending.then(() =>
      generation === this.#generation ? this.#run(input, generation) : undefined,
    );
    this.#pending = run;
    return run;
  };

  /** 던지지 않는다. 멈춘 이유는 단계와 로그로 남긴다 */
  #run = async (input: TodoImportUploadInput, generation: number): Promise<void> => {
    const controller = new AbortController();
    const epoch = this.#ports.signOutEpoch.current();
    const context: RunContext = {
      ...input,
      signal: controller.signal,
      isCurrent: () =>
        generation === this.#generation &&
        epoch === this.#ports.signOutEpoch.current() &&
        !controller.signal.aborted,
    };
    this.#controller = controller;
    this.#isRunning = true;
    let importId: string | null = null;

    try {
      await this.#upload(context, (id) => {
        importId = id;
      });
    } catch (error) {
      this.#handleFailure(error, context, importId);
    } finally {
      this.#isRunning = false;
      if (this.#controller === controller) {
        this.#controller = null;
      }
    }
  };

  #upload = async (context: RunContext, onImportId: (importId: string) => void) => {
    const { accountId, signal, isCurrent } = context;
    const { todoImportApi } = this.#ports;
    let session = readStoredValue(this.#ports.storage, todoImportSessionStoredValue, accountId);
    if (session == null) {
      this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
      return;
    }

    if (session.importId == null) {
      // 앱이 시작 응답 전에 꺼졌다. 같은 키라 서버가 처음 만든 가져오기를 돌려준다
      this.#emitIfCurrent(isCurrent, { stage: 'starting' });
      const { selection, idempotencyKey } = session;
      const started = await this.#request(
        () => todoImportApi.startImport(selection, idempotencyKey, signal),
        context,
      );
      if (!isCurrent()) {
        return;
      }
      session = TodoImportSessionPolicy.withImportId(session, started.id);
      this.#save(accountId, session, isCurrent);
    }
    const importId = session.importId;
    if (importId == null) {
      return;
    }
    onImportId(importId);

    this.#emitIfCurrent(isCurrent, { stage: 'reading', importId });
    const todoImport = await this.#request(
      () => todoImportApi.getImport(importId, signal),
      context,
    );
    if (!isCurrent()) {
      return;
    }
    if (todoImport.status !== 'UPLOADING') {
      // 다른 기기가 확정했거나 서버가 정리했다. 서버 상태가 진실이다
      this.#clear(accountId, isCurrent);
      this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
      return;
    }

    const collectionKeys = session.selection.collections.map(
      (collection) => collection.collectionKey,
    );
    const chunks = await this.#readChunks(todoImport, collectionKeys, context);
    if (chunks == null || !isCurrent()) {
      return;
    }
    const fingerprint = fingerprintItems(chunks);
    if (TodoImportSessionPolicy.hasFingerprintChanged(session, fingerprint)) {
      this.#ports.logger.info(TODO_IMPORT_LOG_EVENT.SESSION_FINGERPRINT_MISMATCH, {
        total: chunks.length,
      });
    }
    session = TodoImportSessionPolicy.withChunks(session, {
      fingerprint,
      chunkCount: chunks.length,
    });
    this.#save(accountId, session, isCurrent);

    // 서버가 한 가져오기에 한 요청씩 받도록 묶음을 차례로 보낸다
    for (let chunkIndex = session.nextChunkIndex; chunkIndex < chunks.length; chunkIndex += 1) {
      const items = chunks[chunkIndex] ?? [];
      this.#emitIfCurrent(isCurrent, {
        stage: 'uploading',
        importId,
        uploadedChunkCount: chunkIndex,
        chunkCount: chunks.length,
      });
      await this.#request(() => todoImportApi.uploadItems(importId, items, signal), context);
      if (!isCurrent()) {
        return;
      }
      session = TodoImportSessionPolicy.withUploadedChunk(session, chunkIndex);
      this.#save(accountId, session, isCurrent);
    }

    this.#emitIfCurrent(isCurrent, { stage: 'committing', importId });
    await this.#request(() => todoImportApi.commitImport(importId, signal), context);
    if (!isCurrent()) {
      return;
    }
    this.#clear(accountId, isCurrent);
    this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
  };

  /** 서버가 정한 시간대로 기간의 첫 순간부터 마지막 날 다음 자정 전까지 한 번 읽는다 */
  #readChunks = async (
    todoImport: TodoImport,
    collectionKeys: readonly string[],
    context: RunContext,
  ) => {
    const { timezone, timeMode, startDate, endDate } = todoImport;
    try {
      const records = await this.#ports.source.readEvents({
        collectionKeys,
        startsAt: getStartOfDateKey(startDate, timezone),
        endsAt: getStartOfDateKey(addDaysToDateKey(endDate, 1), timezone),
      });
      const items = compact(
        records.map((record) =>
          toImportItem(record, { timezone, timeMode, untitledTitle: context.untitledTitle }),
        ),
      );
      return chunkItems(filterByRange(items, { startDate, endDate }));
    } catch (error) {
      this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.SOURCE_READ_FAILED, {
        error: getErrorMessage(error),
      });
      this.#emitIfCurrent(context.isCurrent, { stage: 'paused', importId: todoImport.id });
      return null;
    }
  };

  /**
   * 연결·서버 장애·속도 제한은 기다렸다 다시 보낸다. 4xx는 바로 던진다.
   * retry의 대기는 취소되지 않아, 기다림은 다음 시도 앞에서 실행의 signal로 끊기는 delay로 한다(놓으면 타이머가 남지 않는다)
   */
  #request = <T>(call: () => Promise<Result<T, ApiError>>, context: RunContext): Promise<T> => {
    let waitMs = 0;
    return retry(
      async () => {
        if (waitMs > 0) {
          await delay(waitMs, { signal: context.signal });
        }
        return unwrap(await call());
      },
      {
        retries: TODO_IMPORT_MAX_RETRIES,
        signal: context.signal,
        shouldRetry: (error, attempt) => {
          if (!isRetryableTodoImportError(error) || !context.isCurrent()) {
            return false;
          }
          waitMs = getRetryDelayMs({
            attempt,
            retryAfterMs: findRetryAfterMs(error),
            random: this.#ports.random,
          });
          this.#ports.logger.info(TODO_IMPORT_LOG_EVENT.UPLOAD_CHUNK_RETRYING, {
            total: attempt + 1,
            durationMs: waitMs,
          });
          return true;
        },
      },
    );
  };

  #handleFailure = (error: unknown, context: RunContext, importId: string | null) => {
    const { accountId, isCurrent } = context;
    if (!isCurrent()) {
      return;
    }
    if (isTodoImportNotFoundError(error) || isTodoImportStatusConflictError(error)) {
      this.#clear(accountId, isCurrent);
      this.#emit(IDLE_SNAPSHOT);
      return;
    }
    if (isRetryableTodoImportError(error)) {
      this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.UPLOAD_PAUSED, {
        errorName: toError(error).name,
      });
      this.#emit({ stage: 'paused', importId });
      return;
    }
    const code = findTodoImportRejectionCode(error);
    if (code == null) {
      this.#ports.logger.error(TODO_IMPORT_LOG_EVENT.RESUME_FAILED, toError(error));
      this.#emit({ stage: 'paused', importId });
      return;
    }
    // 서버가 받지 않는 일정(3,000개 초과 등)이다. 업로드 중인 가져오기를 멈추고 기기 상태를 지운다
    this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.UPLOAD_REJECTED, { code });
    if (importId != null) {
      this.#ports.todoImportApi.cancelImport(importId).catch(noop);
    }
    this.#clear(accountId, isCurrent);
    this.#emit({ stage: 'failed', importId, code });
  };

  #save = (accountId: string, session: TodoImportSession, isCurrent: () => boolean) => {
    if (!this.#canWrite(isCurrent)) {
      return;
    }
    writeStoredValue(this.#ports.storage, todoImportSessionStoredValue, session, accountId);
  };

  #clear = (accountId: string, isCurrent: () => boolean) => {
    if (!this.#canWrite(isCurrent)) {
      return;
    }
    try {
      removeStoredValue(this.#ports.storage, todoImportSessionStoredValue, accountId);
    } catch (error) {
      this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.RESUME_FAILED, {
        error: getErrorMessage(error),
      });
    }
  };

  /** 로그아웃·탈퇴로 지운 계정 저장소를 늦은 쓰기가 되살리지 않게 한다 */
  #canWrite = (isCurrent: () => boolean) => {
    if (isCurrent()) {
      return true;
    }
    this.#ports.logger.info(TODO_IMPORT_LOG_EVENT.SESSION_WRITE_DROPPED_AFTER_SIGN_OUT);
    return false;
  };

  #emitIfCurrent = (isCurrent: () => boolean, snapshot: TodoImportUploadSnapshot) => {
    if (isCurrent()) {
      this.#emit(snapshot);
    }
  };

  #emit = (snapshot: TodoImportUploadSnapshot) => {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener();
    }
  };
}
