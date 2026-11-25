import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result, unwrap } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { TodoImportSource } from '@src/core/ports/todo-import-source';
import type { SignOutEpoch } from '@src/core/session/sign-out-epoch';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { getStartOfDateKey } from '@src/shared/date/zoned';
import { toError } from '@src/shared/errors';
import {
  readStoredValue,
  removeStoredValue,
  writeStoredValue,
} from '@src/shared/storage/define-stored-value';
import { getExponentialBackoffMs } from '@src/shared/utils/get-exponential-backoff-ms';
import { getOsPermissionAccess } from '@src/shared/utils/get-os-permission-access';
import { chunk, compact, delay, orderBy, retry, uniqBy } from 'es-toolkit';

import { toTodoImportItem } from '../apis/todo-import-item.mapper';
import type { TodoImportApi } from '../apis/todo-import.api';
import { TODO_IMPORT_LOG_EVENT } from '../constants/todo-import-log-events';
import { TODO_IMPORT_MAX_RETRY_COUNT } from '../constants/todo-import.constants';
import { type TodoImportItem, TodoImportItemPolicy } from '../domains/todo-import-item.model';
import {
  type TodoImportSelection,
  TodoImportSelectionPolicy,
} from '../domains/todo-import-selection.model';
import {
  createTodoImportSession,
  type TodoImportSession,
  TodoImportSessionPolicy,
} from '../domains/todo-import-session.model';
import {
  findRetryAfterMs,
  findTodoImportRejection,
  isRetryableTodoImportError,
  isStartBeforeTodayError,
  isTodoImportNotFoundError,
  isTodoImportStatusConflictError,
} from '../domains/todo-import.error';
import type { TodoImport } from '../domains/todo-import.model';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';

/** interrupted: 연결·서버 장애로 멈춰 다시 시도하면 이어 간다. permission: 캘린더 권한이 꺼져 켜야 이어 간다 */
export type TodoImportPauseReason = 'interrupted' | 'permission';

/** 서버 잡의 진행은 가져오기 조회가 따로 보인다 */
export type TodoImportUploadSnapshot =
  | { stage: 'idle' }
  | { stage: 'starting' }
  | { stage: 'reading'; importId: string }
  | { stage: 'uploading'; importId: string; uploadedChunkCount: number; chunkCount: number }
  | { stage: 'committing'; importId: string }
  | { stage: 'paused'; importId: string | null; reason: TodoImportPauseReason }
  | { stage: 'failed'; importId: string | null; rejection: ApiError };

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
  source: Pick<TodoImportSource, 'getPermission' | 'readEvents'>;
  storage: SyncStorage;
  signOutEpoch: Pick<SignOutEpoch, 'current'>;
  idGenerator: IdGenerator;
  logger: AppLogger;
  /** 기기 시간대의 오늘. 자정 경계 거절 뒤 기간을 다시 맞출 때만 읽는다 */
  getTodayKey: () => DateKey;
  random: () => number;
}

interface StartContext {
  accountId: string;
  /** 이 기기에 이어 올릴 가져오기가 남아 있다. 서버가 새 시작을 받기 전에는 그 상태를 덮거나 지우지 않는다 */
  hasPendingUpload: boolean;
  isCurrent: () => boolean;
  /** 남아 있던 실행을 멈추고 이 시작이 이어 간다 */
  takeOver: () => void;
}

interface RunContext extends TodoImportUploadInput {
  signal: AbortSignal;
  isCurrent: () => boolean;
}

const IDLE_SNAPSHOT: TodoImportUploadSnapshot = { stage: 'idle' };

const RETRY_BASE_DELAY_MS = SECOND_MS;
const MAX_RETRY_DELAY_MS = MINUTE_MS;

interface RetryWaitInput {
  attempt: number;
  retryAfterMs: number | null;
  random: () => number;
}

interface RetryWait {
  // 서버가 Retry-After로 정한 시간. 깨워도 줄지 않는다
  serverMs: number;
  // 서버 시간 뒤에 남는 우리 백오프. 온라인·앱 복귀·다시 시도가 깨우면 건너뛴다
  backoffMs: number;
}

// 재시도 전 기다릴 시간. 백오프(full jitter)는 시도마다 상한이 두 배로 늘고 1분을 넘지 않으며,
// 서버가 정한 시간보다 짧으면 서버 시간만 기다린다. 난수는 인자로 받아 테스트가 정한다
export function getRetryWait({ attempt, retryAfterMs, random }: RetryWaitInput): RetryWait {
  const serverMs = retryAfterMs ?? 0;
  const backoffMs = getExponentialBackoffMs(attempt, {
    baseMs: RETRY_BASE_DELAY_MS,
    maxMs: MAX_RETRY_DELAY_MS,
    random,
  });
  return { serverMs, backoffMs: Math.max(backoffMs - serverMs, 0) };
}

// 가까운 날짜부터 같은 순서로 나눠야 끊긴 뒤 이어 보낼 때 같은 묶음 번호가 같은 일정을 가리킨다.
// 날짜가 같으면 종일(시각 없음)이 먼저다
export function chunkItems(items: readonly TodoImportItem[]): TodoImportItem[][] {
  const ordered = orderBy(
    uniqBy(items, (item) => item.sourceKey),
    [(item) => item.startDate, (item) => item.localTime ?? '', (item) => item.sourceKey],
    ['asc', 'asc', 'asc'],
  );
  return chunk(ordered, TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK);
}

// FNV-1a 32비트. 암호용이 아니라 캘린더가 바뀌었는지 가늠하는 값이고 키는 이미 해시다
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;

// 다시 읽은 캘린더가 같으면 같은 값이라 끊긴 묶음부터 이어 보낸다
export function fingerprintItems(chunks: readonly (readonly TodoImportItem[])[]): string {
  let hash = FNV_OFFSET_BASIS;
  let count = 0;
  for (const item of chunks.flat()) {
    count += 1;
    for (let index = 0; index < item.sourceKey.length; index += 1) {
      hash = Math.imul(hash ^ item.sourceKey.charCodeAt(index), FNV_PRIME);
    }
  }
  return `${count}:${(hash >>> 0).toString(HEX_RADIX)}`;
}

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
  #wakeRetryWait: (() => void) | null = null;

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
   * 4xx는 결과로 돌려주고 연결·서버 오류는 던진다(누른 화면이 알린다).
   * 이 기기에서 올리던 가져오기가 남아 있으면 그 실행과 저장 상태를 건드리지 않고 물어본다. 서버가 그
   * 가져오기를 알려 주면(2301) 누른 화면이 그리로 가고, 서버가 새 시작을 받았을 때만 새 상태로 바꾼다
   */
  start = async ({
    accountId,
    untitledTitle,
    selection,
  }: TodoImportUploadInput & { selection: TodoImportSelection }): Promise<
    Result<StartedTodoImport, ApiError>
  > => {
    const hasPendingUpload =
      readStoredValue(this.#ports.storage, todoImportSessionStoredValue, accountId) != null;
    if (!hasPendingUpload) {
      this.#stopRun();
    }
    let generation = this.#generation;
    const epoch = this.#ports.signOutEpoch.current();
    const context: StartContext = {
      accountId,
      hasPendingUpload,
      isCurrent: () =>
        generation === this.#generation && epoch === this.#ports.signOutEpoch.current(),
      takeOver: () => {
        this.#stopRun();
        generation = this.#generation;
        this.#emit({ stage: 'starting' });
      },
    };
    const { isCurrent } = context;
    if (!hasPendingUpload) {
      this.#emit({ stage: 'starting' });
    }

    try {
      const result = await this.#postStart(
        createTodoImportSession({
          idempotencyKey: this.#ports.idGenerator.create(),
          selection,
          hasAdjustedRange: false,
        }),
        context,
      );
      if (!result.ok) {
        if (!hasPendingUpload) {
          this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
        }
        return result;
      }
      if (isCurrent()) {
        this.#schedule({ accountId, untitledTitle }, generation);
      }
      return result;
    } catch (error) {
      // 누른 화면이 연결 오류를 알리고 사용자가 다시 누른다. 남겨 두면 나중에 모르는 가져오기가 시작된다
      if (!hasPendingUpload) {
        if (isCurrent()) {
          this.#clear(accountId, isCurrent);
        }
        this.#emitIfCurrent(isCurrent, IDLE_SNAPSHOT);
      }
      throw error;
    }
  };

  /** 서버에 멈춤을 보내고 받으면 이 기기의 업로드 상태를 지운다. 서버에 없거나 이미 끝났어도 지운다 */
  cancel = async ({
    accountId,
    importId,
  }: {
    accountId: string | null;
    importId: string;
  }): Promise<Result<TodoImport, ApiError>> => {
    const epoch = this.#ports.signOutEpoch.current();
    const result = await this.#ports.todoImportApi.cancelImport(importId);
    const isSettledOnServer =
      result.ok ||
      isTodoImportNotFoundError(result.error) ||
      isTodoImportStatusConflictError(result.error);
    if (accountId == null || !isSettledOnServer) {
      return result;
    }
    const stored = readStoredValue(this.#ports.storage, todoImportSessionStoredValue, accountId);
    if (stored?.importId === importId) {
      this.#stopRun();
      this.#clear(accountId, () => epoch === this.#ports.signOutEpoch.current());
      this.#emit(IDLE_SNAPSHOT);
    }
    return result;
  };

  /** 돌고 있으면 새로 돌리지 않고 그 실행을 기다린다. 재시도를 기다리던 실행은 남은 백오프를 건너뛰고 다시 보낸다 */
  resume = (input: TodoImportUploadInput): Promise<void> => {
    if (this.#isRunning) {
      this.#wakeRetryWait?.();
      return this.#pending;
    }
    return this.#schedule(input, this.#generation);
  };

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
    session: TodoImportSession,
    context: StartContext,
  ): Promise<Result<StartedTodoImport, ApiError>> => {
    const { accountId, hasPendingUpload, isCurrent } = context;
    if (!hasPendingUpload) {
      this.#save(accountId, session, isCurrent);
    }
    const result = await this.#ports.todoImportApi.startImport(
      session.selection,
      session.idempotencyKey,
    );
    if (!isCurrent()) {
      return result.ok ? ok({ todoImport: result.value, isRangeAdjusted: false }) : result;
    }
    if (!result.ok) {
      const adjusted = this.#adjustToTodayIfNeeded(result.error, session);
      if (adjusted != null) {
        return this.#postStart(adjusted, context);
      }
      if (!hasPendingUpload) {
        this.#clear(accountId, isCurrent);
      }
      return result;
    }
    // 서버가 새 시작을 받았으면 남아 있던 업로드는 서버에서 이미 끝났다. 앞 실행을 멈추고 새 상태로 바꾼다
    if (hasPendingUpload) {
      context.takeOver();
    }
    this.#save(
      accountId,
      TodoImportSessionPolicy.withImportId(session, result.value.id),
      isCurrent,
    );
    return ok({ todoImport: result.value, isRangeAdjusted: session.hasAdjustedRange });
  };

  /** 기기 자정과 서버 자정이 어긋난 거절이면 오늘부터로 맞춘 새 키의 상태다. 한 번만 맞춘다 */
  #adjustToTodayIfNeeded = (
    error: unknown,
    session: TodoImportSession,
  ): TodoImportSession | null => {
    if (session.hasAdjustedRange || !isStartBeforeTodayError(error)) {
      return null;
    }
    const selection = TodoImportSelectionPolicy.findAdjustedToToday(
      session.selection,
      this.#ports.getTodayKey(),
    );
    return selection == null
      ? null
      : createTodoImportSession({
          idempotencyKey: this.#ports.idGenerator.create(),
          selection,
          hasAdjustedRange: true,
        });
  };

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
      const started = await this.#restart(session, context);
      if (started == null) {
        return;
      }
      session = started;
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
    const firstChunkIndex = session.nextChunkIndex;
    for (const [chunkIndex, items] of chunks.entries()) {
      if (chunkIndex < firstChunkIndex) {
        continue;
      }
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

  /**
   * 시작 응답을 받지 못한 가져오기를 같은 키로 다시 보낸다. 다음 날 이어 가 서버가 기간 첫날을 어제로
   * 거절하면 누른 시작과 같이 오늘부터로 한 번 맞춰 새 키로 보낸다. 멈췄으면 null이다
   */
  #restart = async (
    session: TodoImportSession,
    context: RunContext,
  ): Promise<TodoImportSession | null> => {
    const { accountId, signal, isCurrent } = context;
    try {
      const started = await this.#request(
        () =>
          this.#ports.todoImportApi.startImport(session.selection, session.idempotencyKey, signal),
        context,
      );
      if (!isCurrent()) {
        return null;
      }
      const startedSession = TodoImportSessionPolicy.withImportId(session, started.id);
      this.#save(accountId, startedSession, isCurrent);
      return startedSession;
    } catch (error) {
      const adjusted = this.#adjustToTodayIfNeeded(error, session);
      if (adjusted == null || !isCurrent()) {
        throw error;
      }
      this.#save(accountId, adjusted, isCurrent);
      return this.#restart(adjusted, context);
    }
  };

  /** 서버가 정한 시간대로 기간의 첫 순간부터 마지막 날 다음 자정 전까지 한 번 읽는다 */
  #readChunks = async (
    todoImport: TodoImport,
    collectionKeys: readonly string[],
    context: RunContext,
  ) => {
    const { timezone, timeMode, startDate, endDate } = todoImport;
    try {
      // 설정에서 캘린더 접근을 끄면 읽기가 계속 실패한다. 다시 시도해도 같으니 권한 이유로 멈춘다
      const permission = await this.#ports.source.getPermission();
      if (getOsPermissionAccess(permission) !== 'granted') {
        this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.SOURCE_PERMISSION_MISSING, {
          status: permission.status,
        });
        this.#emitIfCurrent(context.isCurrent, {
          stage: 'paused',
          importId: todoImport.id,
          reason: 'permission',
        });
        return null;
      }
      const records = await this.#ports.source.readEvents({
        collectionKeys,
        startsAt: getStartOfDateKey(startDate, timezone),
        endsAt: getStartOfDateKey(addDaysToDateKey(endDate, 1), timezone),
      });
      const items = compact(
        records.map((record) =>
          toTodoImportItem(record, { timezone, timeMode, untitledTitle: context.untitledTitle }),
        ),
      );
      return chunkItems(TodoImportItemPolicy.filterByRange(items, { startDate, endDate }));
    } catch (error) {
      // 네이티브 오류 원문에는 일정 제목 같은 사용자 내용이 들어올 수 있어 이름만 남긴다
      this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.SOURCE_READ_FAILED, {
        errorName: toError(error).name,
      });
      this.#emitIfCurrent(context.isCurrent, {
        stage: 'paused',
        importId: todoImport.id,
        reason: 'interrupted',
      });
      return null;
    }
  };

  /**
   * 연결·서버 장애·속도 제한은 기다렸다 다시 보낸다. 4xx는 바로 던진다.
   * retry의 대기는 취소되지 않아, 기다림은 다음 시도 앞에서 끊을 수 있는 delay로 한다(놓으면 타이머가 남지 않는다).
   * 깨워서 일찍 보낸 시도는 재시도 횟수에 넣지 않는다. 앱 복귀가 잦아도 횟수가 먼저 닳아 더 일찍 멈추지 않는다
   */
  #request = <T>(call: () => Promise<Result<T, ApiError>>, context: RunContext): Promise<T> => {
    let retryCount = 0;
    let wait: RetryWait | null = null;
    return retry(
      async () => {
        if (wait != null) {
          const isWoken = await this.#waitForRetry(wait, context.signal);
          if (!isWoken) {
            retryCount += 1;
          }
        }
        return unwrap(await call());
      },
      {
        signal: context.signal,
        shouldRetry: (error) => {
          const hasRetryLeft = retryCount < TODO_IMPORT_MAX_RETRY_COUNT;
          if (!hasRetryLeft || !isRetryableTodoImportError(error) || !context.isCurrent()) {
            return false;
          }
          wait = getRetryWait({
            attempt: retryCount,
            retryAfterMs: findRetryAfterMs(error),
            random: this.#ports.random,
          });
          this.#ports.logger.info(TODO_IMPORT_LOG_EVENT.UPLOAD_CHUNK_RETRYING, {
            total: retryCount + 1,
            durationMs: wait.serverMs + wait.backoffMs,
          });
          return true;
        },
      },
    );
  };

  /**
   * 서버가 정한 시간은 실행이 멈출 때만 끝나고, 그 뒤 남은 백오프는 `resume`이 깨우면 건너뛴다.
   * 서버 시간 동안 깨웠으면 그 시간이 지난 뒤 백오프를 기다리지 않는다. 백오프를 건너뛰었으면 true다
   */
  #waitForRetry = async (
    { serverMs, backoffMs }: RetryWait,
    runSignal: AbortSignal,
  ): Promise<boolean> => {
    const backoff = new AbortController();
    const wake = () => backoff.abort();
    runSignal.addEventListener('abort', wake);
    this.#wakeRetryWait = wake;
    try {
      if (0 < serverMs) {
        await delay(serverMs, { signal: runSignal });
      }
      if (backoffMs === 0) {
        return false;
      }
      if (!backoff.signal.aborted) {
        await delay(backoffMs, { signal: backoff.signal });
        return false;
      }
      return true;
    } catch (error) {
      if (runSignal.aborted) {
        throw error;
      }
      return true;
    } finally {
      runSignal.removeEventListener('abort', wake);
      this.#wakeRetryWait = null;
    }
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
      this.#emit({ stage: 'paused', importId, reason: 'interrupted' });
      return;
    }
    const rejection = findTodoImportRejection(error);
    if (rejection == null) {
      this.#ports.logger.error(TODO_IMPORT_LOG_EVENT.RESUME_FAILED, toError(error));
      this.#emit({ stage: 'paused', importId, reason: 'interrupted' });
      return;
    }
    // 서버가 받지 않는 일정(3,000개 초과 등)이나 확정 때 바뀐 한도·카테고리다. 업로드 중인 가져오기를
    // 멈추고 기기 상태를 지운다. 이유는 이 기기 화면이 보인다
    this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.UPLOAD_REJECTED, { code: rejection.code });
    if (importId != null) {
      // 멈추지 못해도(5xx·연결 끊김) 이 기기의 업로드는 끝났다. 서버가 버려진 가져오기를 정리하고 여기서는 흔적만 남긴다
      this.#ports.todoImportApi.cancelImport(importId).catch((error: unknown) =>
        this.#ports.logger.warn(TODO_IMPORT_LOG_EVENT.UPLOAD_CANCEL_FAILED, {
          errorName: toError(error).name,
        }),
      );
    }
    this.#clear(accountId, isCurrent);
    this.#emit({ stage: 'failed', importId, rejection });
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
        errorName: toError(error).name,
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
