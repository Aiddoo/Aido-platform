import type { ErrorReporter } from '@src/core/ports/error-reporter';

import type { WidgetBridge } from '../bridge/widget-bridge';
import type { WidgetSnapshot } from '../domains/widget-snapshot.model';
import {
  toLoggedOutWidgetSnapshot,
  toWidgetSnapshot,
  type WidgetDaySummaries,
  type WidgetSnapshotContext,
} from './widget-snapshot.mapper';

export class WidgetSyncService {
  readonly #bridge: WidgetBridge;
  readonly #errorReporter: ErrorReporter;
  #pendingWrite: Promise<void> = Promise.resolve();
  #generation = 0;
  #lastSnapshotKey: string | null = null;

  constructor(bridge: WidgetBridge, errorReporter: ErrorReporter) {
    this.#bridge = bridge;
    this.#errorReporter = errorReporter;
  }

  syncSummary(summaries: WidgetDaySummaries, context: WidgetSnapshotContext): Promise<void> {
    return this.#scheduleWrite(
      () => toWidgetSnapshot(summaries, context),
      'syncSummary',
      context.userId ?? null,
      context.timeZone,
    );
  }

  syncLoggedOut(localDate: string, context: WidgetSnapshotContext): Promise<void> {
    return this.#scheduleWrite(
      () => toLoggedOutWidgetSnapshot(localDate, context),
      'syncLoggedOut',
      null,
      context.timeZone,
    );
  }

  #scheduleWrite(
    createSnapshot: () => WidgetSnapshot,
    method: string,
    userId: string | null,
    timeZone: string,
  ): Promise<void> {
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
  }

  #report(error: unknown, method: string): void {
    try {
      this.#errorReporter.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { feature: 'widget', method },
      );
    } catch {
      // Widget and observability failures must not reject the app's auth lifecycle.
    }
  }
}
