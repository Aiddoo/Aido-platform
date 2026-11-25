import type { DateKey } from '@src/shared/date/date-key';
import { z } from 'zod';

import type { WidgetDaySnapshot, WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';

/** 위젯 렌더 시점의 표시 상태 — 스냅샷 상태에 자정 경과(stale)를 더한 판정 결과 */
export const widgetRenderStateSchema = z.enum(['data', 'empty', 'loggedOut', 'stale']);
export type WidgetRenderState = z.infer<typeof widgetRenderStateSchema>;

interface WidgetDaySelection {
  day: WidgetDaySnapshot;
  renderState: WidgetRenderState;
}

export const WidgetSnapshotPolicy = {
  isLoggedOut(snapshot: WidgetSnapshot): boolean {
    return snapshot.days[0].state === 'loggedOut';
  },

  /** 렌더 시점의 오늘 key와 같은 day를 고른다. 없으면 날짜가 지난 것으로 보고 stale을 표시한다. */
  getDay(snapshot: WidgetSnapshot, todayLocalDate: DateKey): WidgetDaySelection {
    const [firstDay] = snapshot.days;
    if (this.isLoggedOut(snapshot)) {
      return { day: firstDay, renderState: 'loggedOut' };
    }

    const today = snapshot.days.find((day) => day.date === todayLocalDate);
    if (today == null) {
      return { day: firstDay, renderState: 'stale' };
    }
    return { day: today, renderState: today.state };
  },

  /** 소유자를 모르는 개인 목록은 추측해 보여주지 않고 stale로 표시한다. */
  getDayForOwner(
    snapshot: WidgetSnapshot,
    todayLocalDate: DateKey,
    ownerId: string | null,
  ): WidgetDaySelection {
    if (ownerId == null && !this.isLoggedOut(snapshot)) {
      return { day: snapshot.days[0], renderState: 'stale' };
    }
    return this.getDay(snapshot, todayLocalDate);
  },
};
