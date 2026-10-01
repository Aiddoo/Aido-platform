import type { ErrorReporter } from '@src/core/ports/error-reporter';

import type { WidgetBridge } from '../bridge/widget-bridge';
import type { WidgetSnapshot } from '../models/widget-snapshot.model';
import {
  toLoggedOutWidgetSnapshot,
  toWidgetSnapshot,
  type WidgetSnapshotContext,
  type WidgetSummaryInput,
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

  syncSummary(summary: WidgetSummaryInput, context: WidgetSnapshotContext): Promise<void> {
    return this.#scheduleWrite(() => toWidgetSnapshot(summary, context), 'syncSummary');
  }

  syncLoggedOut(localDate: string, context: WidgetSnapshotContext): Promise<void> {
    return this.#scheduleWrite(
      () => toLoggedOutWidgetSnapshot(localDate, context),
      'syncLoggedOut',
    );
  }

  #scheduleWrite(createSnapshot: () => WidgetSnapshot, method: string): Promise<void> {
    const generation = ++this.#generation;

    // Native writes are serialized so an in-flight account snapshot cannot overwrite logout.
    this.#pendingWrite = this.#pendingWrite.then(async () => {
      if (generation !== this.#generation) {
        return;
      }

      try {
        const snapshot = createSnapshot();
        const snapshotKey = JSON.stringify({ ...snapshot, updatedAtIso: '' });
        if (snapshotKey === this.#lastSnapshotKey) return;

        await this.#bridge.writeSnapshot(snapshot);
        this.#lastSnapshotKey = snapshotKey;
        this.#errorReporter.addBreadcrumb({
          category: 'widget',
          message: 'widget snapshot synced',
          data: { date: snapshot.date, state: snapshot.state, total: snapshot.totalTodos },
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
