import type { WidgetBridge } from '@src/features/device/widget/services/widget-sync.service';
import { WidgetTimelineService } from '@src/features/device/widget/services/widget-timeline.service';
import { getAppScheme } from '@src/shared/config/app-scheme';
import { getNowInstant, readLocalDateState } from '@src/shared/date/clock';

export function createWidgetBridge(): WidgetBridge {
  return new WidgetTimelineService({
    now: getNowInstant,
    readTimezone: (now) => readLocalDateState({ now }).currentTimezone,
    appScheme: getAppScheme(),
  });
}
