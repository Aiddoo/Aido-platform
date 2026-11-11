import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { SyncStorage } from '@src/core/ports/sync-storage';
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

export class WidgetSyncService {
  readonly #bridge: WidgetBridge;
  readonly #errorReporter: ErrorReporter;
  /** 위젯만 깨어난 프로세스가 실패를 남기는 위젯 저장소 */
  readonly #widgetStorage: SyncStorage;
  #pendingWrite: Promise<void> = Promise.resolve();
  #generation = 0;
  #lastSnapshotKey: string | null = null;

  constructor(bridge: WidgetBridge, errorReporter: ErrorReporter, widgetStorage: SyncStorage) {
    this.#bridge = bridge;
    this.#errorReporter = errorReporter;
    this.#widgetStorage = widgetStorage;
  }

  /** 앱 없이 깨어난 위젯이 남긴 실패를 꺼내 지우고 오류 보고기로 보낸다. 앱 시작을 막지 않는다 */
  reportHeadlessFailure = (): void => {
    const failure = readStoredValue(this.#widgetStorage, widgetHeadlessFailureStoredValue);
    try {
      removeStoredValue(this.#widgetStorage, widgetHeadlessFailureStoredValue);
    } catch {
      // Widget storage failures must not reject the app's startup.
    }
    if (failure == null) {
      return;
    }
    const error = new Error(failure.message);
    error.name = failure.name;
    this.#report(error, failure.method);
  };

  syncSummary = (summaries: WidgetDaySummaries, context: WidgetSnapshotContext): Promise<void> =>
    this.#scheduleWrite(
      () => toWidgetSnapshot(summaries, context),
      'syncSummary',
      context.userId ?? null,
      context.timeZone,
    );

  syncLoggedOut = (localDate: string, context: WidgetSnapshotContext): Promise<void> =>
    this.#scheduleWrite(
      () => toLoggedOutWidgetSnapshot(localDate, context),
      'syncLoggedOut',
      null,
      context.timeZone,
    );

  #scheduleWrite = (
    createSnapshot: () => WidgetSnapshot,
    method: string,
    userId: string | null,
    timeZone: string,
  ): Promise<void> => {
    const generation = ++this.#generation;

    // Native writes are serialized so an in-flight account snapshot cannot overwrite logout.
    this.#pendingWrite = this.#pendingWrite.then(async () => {
      if (generation !== this.#generation) {
        return;
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
          return;
        }

        await this.#bridge.writeSnapshot(snapshot, userId);
        this.#lastSnapshotKey = snapshotKey;
        this.#errorReporter.addBreadcrumb({
          category: 'widget',
          message: 'widget snapshot synced',
          data: {
            date: snapshot.days[0].date,
            state: snapshot.days[0].state,
            total: snapshot.days[0].totalTodos,
            dayCount: snapshot.days.length,
          },
        });
      } catch (error) {
        this.#report(error, method);
      }
    });

    return this.#pendingWrite;
  };

  #report = (error: unknown, method: string): void => {
    try {
      this.#errorReporter.captureException(toError(error), { feature: 'widget', method });
    } catch {
      // Widget and observability failures must not reject the app's auth lifecycle.
    }
  };
}
