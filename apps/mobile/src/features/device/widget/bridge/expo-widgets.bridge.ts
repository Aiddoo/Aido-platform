import { getAppScheme } from '@src/shared/config/app-scheme';
import { getNowInstant, readDeviceLocalDateState } from '@src/shared/date/clock';

import { AIDO_WIDGETS } from '../components/widgets';
import type { WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import type { WidgetBridge } from './widget-bridge';
import { toWidgetTimelineEntries } from './widget-timeline.mapper';

export function createExpoWidgetsBridge(): WidgetBridge {
  const appScheme = getAppScheme();
  return {
    async writeSnapshot(snapshot: WidgetSnapshot): Promise<void> {
      const now = getNowInstant();
      const { currentTimeZone } = readDeviceLocalDateState(now);
      const entries = toWidgetTimelineEntries(snapshot, {
        now,
        timeZone: currentTimeZone,
        appScheme,
      });

      for (const { widget } of AIDO_WIDGETS) {
        widget.updateTimeline(entries);
      }
    },
  };
}
