import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { DateKey } from '@src/shared/date/date-key';
import { toError } from '@src/shared/errors';
import { readStoredValue, removeStoredValue } from '@src/shared/storage/define-stored-value';

import {
  toLoggedOutWidgetSnapshot,
  toWidgetSnapshot,
  type WidgetDaySummaries,
  type WidgetSnapshotContext,
} from '../apis/widget-snapshot.mapper';
import type { WidgetBridge } from '../bridge/widget-bridge';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import type { WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';

/** 쓰기는 앱 인증·시작을 막지 않도록 던지지 않고 결과로 알린다. 보고는 부른 훅이 한다 */
export type WidgetSyncResult =
  | { status: 'written'; snapshot: WidgetSnapshot }
  | { status: 'unchanged' }
  | { status: 'superseded' }
  | { status: 'failed'; error: Error };

interface WidgetHeadlessFailure {
  error: Error;
  method: string;
}

export class WidgetSyncService {
  readonly #bridge: WidgetBridge;
  /** 위젯만 깨어난 프로세스가 실패를 남기는 위젯 저장소 */
  readonly #widgetStorage: SyncStorage;
  #pendingWrite: Promise<unknown> = Promise.resolve();
  #generation = 0;
  #lastSnapshotKey: string | null = null;

  constructor(bridge: WidgetBridge, widgetStorage: SyncStorage) {
    this.#bridge = bridge;
    this.#widgetStorage = widgetStorage;
  }

  /** 앱 없이 깨어난 위젯이 남긴 실패를 꺼내고 지운다. 한 번만 돌려준다 */
  takeHeadlessFailure = (): WidgetHeadlessFailure | null => {
    const failure = readStoredValue(this.#widgetStorage, widgetHeadlessFailureStoredValue);
    try {
      removeStoredValue(this.#widgetStorage, widgetHeadlessFailureStoredValue);
    } catch {
      // Widget storage failures must not reject the app's startup.
    }
    if (failure == null) {
      return null;
    }
    const error = new Error(failure.message);
    error.name = failure.name;
    return { error, method: failure.method };
  };

  syncSummary = (
    summaries: WidgetDaySummaries,
    context: WidgetSnapshotContext,
    userId: string,
  ): Promise<WidgetSyncResult> =>
    this.#scheduleWrite(() => toWidgetSnapshot(summaries, context), userId, context.timeZone);

  syncLoggedOut = (localDate: DateKey, context: WidgetSnapshotContext): Promise<WidgetSyncResult> =>
    this.#scheduleWrite(
      () => toLoggedOutWidgetSnapshot(localDate, context),
      null,
      context.timeZone,
    );

  #scheduleWrite = (
    createSnapshot: () => WidgetSnapshot,
    userId: string | null,
    timeZone: string,
  ): Promise<WidgetSyncResult> => {
    const generation = ++this.#generation;

    // Native writes are serialized so an in-flight account snapshot cannot overwrite logout.
    const write = this.#pendingWrite.then(async (): Promise<WidgetSyncResult> => {
      if (generation !== this.#generation) {
        return { status: 'superseded' };
      }

      try {
        const snapshot = createSnapshot();
        // 시간대가 바뀌면 같은 내용이어도 iOS timeline의 자정 경계가 달라지므로 다시 쓴다.
        const snapshotKey = JSON.stringify({
          snapshot: { ...snapshot, updatedAtIso: '' },
          userId,
          timeZone,
        });
        if (snapshotKey === this.#lastSnapshotKey) {
          return { status: 'unchanged' };
        }

        await this.#bridge.writeSnapshot(snapshot, userId);
        this.#lastSnapshotKey = snapshotKey;
        return { status: 'written', snapshot };
      } catch (error) {
        return { status: 'failed', error: toError(error) };
      }
    });
    this.#pendingWrite = write;

    return write;
  };
}
