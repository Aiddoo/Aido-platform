import { dateKeySchema, type DateKey } from '@src/shared/date/date-key';
import { z } from 'zod';

/** 위젯 렌더 시점의 표시 상태 — 스냅샷 상태에 자정 경과(stale)를 더한 판정 결과 */
export const widgetRenderStateSchema = z.enum(['data', 'empty', 'loggedOut', 'stale']);
export type WidgetRenderState = z.infer<typeof widgetRenderStateSchema>;

/** 하루치 위젯 표시. 어느 날을 보일지 고르는 데 쓰는 칸만 둔다(표시 문구·숫자는 저장 모양이 더한다) */
export const widgetSnapshotDaySchema = z.object({
  /** data: 그날 할 일 있음 · empty: 로그인했으나 그날 할 일 없음 · loggedOut: 비로그인 */
  state: widgetRenderStateSchema.exclude(['stale']),
  /** 이 day가 설명하는 로컬 날짜 — 렌더 시점 오늘 key와 비교한다 */
  date: dateKeySchema,
});
type WidgetSnapshotDay = z.infer<typeof widgetSnapshotDaySchema>;

/** 내일 day를 함께 두어 자정이 지나면 앱을 열기 전에도 새 날짜를 보인다 */
export const widgetSnapshotSchema = z.object({
  days: z.union([
    z.tuple([widgetSnapshotDaySchema]),
    z.tuple([widgetSnapshotDaySchema, widgetSnapshotDaySchema]),
  ]),
});
export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;

interface WidgetDaySelection<Day extends WidgetSnapshotDay> {
  day: Day;
  renderState: WidgetRenderState;
}

export const WidgetSnapshotPolicy = {
  isLoggedOut(snapshot: WidgetSnapshot): boolean {
    return snapshot.days[0].state === 'loggedOut';
  },

  /** 렌더 시점의 오늘 key와 같은 day를 고른다. 없으면 날짜가 지난 것으로 보고 stale을 표시한다. */
  getDay<Snapshot extends WidgetSnapshot>(
    snapshot: Snapshot,
    todayLocalDate: DateKey,
  ): WidgetDaySelection<Snapshot['days'][number]> {
    const days: readonly Snapshot['days'][number][] = snapshot.days;
    const [firstDay] = snapshot.days;
    if (this.isLoggedOut(snapshot)) {
      return { day: firstDay, renderState: 'loggedOut' };
    }

    const today = days.find((day) => day.date === todayLocalDate);
    if (today == null) {
      return { day: firstDay, renderState: 'stale' };
    }
    return { day: today, renderState: today.state };
  },

  /** 소유자를 모르는 개인 목록은 추측해 보여주지 않고 stale로 표시한다. */
  getDayForOwner<Snapshot extends WidgetSnapshot>(
    snapshot: Snapshot,
    todayLocalDate: DateKey,
    ownerId: string | null,
  ): WidgetDaySelection<Snapshot['days'][number]> {
    if (ownerId == null && !this.isLoggedOut(snapshot)) {
      return { day: snapshot.days[0], renderState: 'stale' };
    }
    return this.getDay(snapshot, todayLocalDate);
  },
};
