import type { ErrorReporter } from '@src/core/ports/error-reporter';

import type { WidgetBridge } from '../bridge/widget-bridge';
import {
  toLoggedOutWidgetSnapshot,
  toWidgetSnapshot,
  type WidgetSnapshotContext,
  type WidgetSummaryInput,
} from './widget-snapshot.mapper';

/**
 * 위젯 동기화 오케스트레이션 — 요약을 스냅샷으로 변환해 플랫폼 브리지에 기록한다.
 *
 * 절대 throw하지 않는다: 위젯은 부가 기능이므로 실패는 관측(Sentry)만 하고
 * 앱 흐름에 어떤 영향도 주지 않는다.
 */
export class WidgetSyncService {
  readonly #bridge: WidgetBridge;
  readonly #errorReporter: ErrorReporter;

  constructor(bridge: WidgetBridge, errorReporter: ErrorReporter) {
    this.#bridge = bridge;
    this.#errorReporter = errorReporter;
  }

  async syncSummary(summary: WidgetSummaryInput, context: WidgetSnapshotContext): Promise<void> {
    try {
      await this.#bridge.writeSnapshot(toWidgetSnapshot(summary, context));
      // 이벤트가 아닌 행적만 남긴다 — 동기화는 빈번하므로 breadcrumb로 노이즈 없이 추적
      this.#errorReporter.addBreadcrumb({
        category: 'widget',
        message: 'widget snapshot synced',
        data: { date: summary.date, total: summary.totalTodos, completed: summary.completedTodos },
      });
    } catch (error) {
      this.#report(error, 'syncSummary');
    }
  }

  async syncLoggedOut(localDate: string, context: WidgetSnapshotContext): Promise<void> {
    try {
      await this.#bridge.writeSnapshot(toLoggedOutWidgetSnapshot(localDate, context));
      this.#errorReporter.addBreadcrumb({
        category: 'widget',
        message: 'widget snapshot cleared to logged-out',
        data: { date: localDate },
      });
    } catch (error) {
      this.#report(error, 'syncLoggedOut');
    }
  }

  #report(error: unknown, method: string): void {
    this.#errorReporter.captureException(
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'widget', method },
    );
  }
}
