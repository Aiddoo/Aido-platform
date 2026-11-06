import type {
  WidgetDaySnapshot,
  WidgetRenderState,
  WidgetSnapshot,
} from '../schemas/widget-snapshot.schema';

function isWidgetSnapshotLoggedOut(snapshot: WidgetSnapshot): boolean {
  return snapshot.days[0].state === 'loggedOut';
}

interface WidgetDaySelection {
  day: WidgetDaySnapshot;
  renderState: WidgetRenderState;
}

/** 렌더 시점의 오늘 key와 같은 day를 고른다. 없으면 날짜가 지난 것으로 보고 stale을 표시한다. */
function selectWidgetDay(snapshot: WidgetSnapshot, todayLocalDate: string): WidgetDaySelection {
  const [firstDay] = snapshot.days;
  if (isWidgetSnapshotLoggedOut(snapshot)) {
    return { day: firstDay, renderState: 'loggedOut' };
  }

  const today = snapshot.days.find((day) => day.date === todayLocalDate);
  if (today == null) {
    return { day: firstDay, renderState: 'stale' };
  }
  return { day: today, renderState: today.state };
}

/** 소유자를 모르는 개인 목록은 추측해 보여주지 않고 stale로 표시한다. */
function selectWidgetDayForOwner(
  snapshot: WidgetSnapshot,
  todayLocalDate: string,
  ownerId: string | null,
): WidgetDaySelection {
  if (ownerId == null && !isWidgetSnapshotLoggedOut(snapshot)) {
    return { day: snapshot.days[0], renderState: 'stale' };
  }
  return selectWidgetDay(snapshot, todayLocalDate);
}

export const WidgetSnapshotPolicy = {
  isLoggedOut: isWidgetSnapshotLoggedOut,
  selectDay: selectWidgetDay,
  selectDayForOwner: selectWidgetDayForOwner,
} as const;
