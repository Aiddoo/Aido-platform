import type {
  WidgetDaySnapshot,
  WidgetRenderState,
  WidgetSnapshot,
} from '../schemas/widget-snapshot.schema';

function isLoggedOut(snapshot: WidgetSnapshot): boolean {
  return snapshot.days[0].state === 'loggedOut';
}

interface WidgetDaySelection {
  day: WidgetDaySnapshot;
  renderState: WidgetRenderState;
}

function getDay(snapshot: WidgetSnapshot, todayLocalDate: string): WidgetDaySelection {
  const [firstDay] = snapshot.days;
  if (isLoggedOut(snapshot)) {
    return { day: firstDay, renderState: 'loggedOut' };
  }

  const today = snapshot.days.find((day) => day.date === todayLocalDate);
  if (today == null) {
    return { day: firstDay, renderState: 'stale' };
  }
  return { day: today, renderState: today.state };
}

function getDayForOwner(
  snapshot: WidgetSnapshot,
  todayLocalDate: string,
  ownerId: string | null,
): WidgetDaySelection {
  if (ownerId == null && !isLoggedOut(snapshot)) {
    return { day: snapshot.days[0], renderState: 'stale' };
  }
  return getDay(snapshot, todayLocalDate);
}

export const WidgetSnapshotPolicy = {
  isLoggedOut,
  getDay,
  getDayForOwner,
} as const;
