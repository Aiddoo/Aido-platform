import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { DateKey } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import { toError } from '@src/shared/errors';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';
import { readStoredValue, removeStoredValue } from '@src/shared/storage/define-stored-value';

import {
  toLoggedOutWidgetDaySnapshot,
  toWidgetDaySnapshot,
  toWidgetSnapshot,
  type WidgetDaySummaries,
  type WidgetSummaryInput,
} from '../apis/widget-snapshot.mapper';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import type { StoredWidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import {
  getWidgetSnapshotStrings,
  getWidgetWeek,
  type WidgetTranslateFn,
  type WidgetWeekCompletion,
} from '../utils/widget-snapshot.view-model';

/** 플랫폼 위젯에 스냅숏을 쓰는 곳(iOS timeline·Android 저장소). 조립(`create-widget-bridge`)이 플랫폼마다 넣는다 */
export interface WidgetBridge {
  /** userId는 스냅샷 주인. 로그아웃 스냅샷처럼 주인이 없으면 null이다 */
  writeSnapshot(snapshot: StoredWidgetSnapshot, userId: string | null): Promise<void>;
}

export interface WidgetSnapshotContext {
  t: WidgetTranslateFn;
  locale: ResolvedLanguage;
  now: Instant;
  /** 쓰기 시점의 기기 시간대. 표시 내용이 같아도 바뀌면 iOS timeline의 자정 경계를 다시 써야 한다. */
  timezone: string;
  weekCompletions?: readonly WidgetWeekCompletion[];
}

/** 쓰기는 앱 인증·시작을 막지 않도록 던지지 않고 결과로 알린다. 보고는 부른 훅이 한다 */
export type WidgetSyncResult =
  | { status: 'written'; snapshot: StoredWidgetSnapshot }
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
    { today, tomorrow }: WidgetDaySummaries,
    context: WidgetSnapshotContext,
    userId: string,
  ): Promise<WidgetSyncResult> =>
    this.#scheduleWrite(
      () => {
        const todayDay = this.#toDaySnapshot(today, context);
        return toWidgetSnapshot(
          tomorrow == null ? [todayDay] : [todayDay, this.#toDaySnapshot(tomorrow, context)],
          context.now,
        );
      },
      userId,
      context.timezone,
    );

  syncLoggedOut = (localDate: DateKey, context: WidgetSnapshotContext): Promise<WidgetSyncResult> =>
    this.#scheduleWrite(
      () => {
        const strings = getWidgetSnapshotStrings(context.t, {
          completedTodos: 0,
          totalTodos: 0,
          completionRate: 0,
          currentStreak: 0,
        });
        return toWidgetSnapshot(
          [toLoggedOutWidgetDaySnapshot(localDate, strings, context.locale)],
          context.now,
        );
      },
      null,
      context.timezone,
    );

  // 위젯은 번역하지 못해 그날의 문구·주간 달력을 view-model로 구워 mapper가 저장 모양에 담는다
  #toDaySnapshot = (summary: WidgetSummaryInput, context: WidgetSnapshotContext) =>
    toWidgetDaySnapshot(
      summary,
      {
        strings: getWidgetSnapshotStrings(context.t, summary),
        week: getWidgetWeek(summary, context),
      },
      context.locale,
    );

  #scheduleWrite = (
    createSnapshot: () => StoredWidgetSnapshot,
    userId: string | null,
    timezone: string,
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
          timezone,
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
