import { getAppScheme } from '@src/shared/config/app-scheme';
import { readDeviceLocalDateState } from '@src/shared/date/local-date-clock';

import { AIDO_WIDGETS } from '../components/widgets';
import type { WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import type { WidgetBridge } from './widget-bridge';
import { toWidgetTimelineEntries } from './widget-timeline.mapper';

export function createExpoWidgetsBridge(): WidgetBridge {
  const appScheme = getAppScheme();
  return {
    async writeSnapshot(snapshot: WidgetSnapshot): Promise<void> {
      const { currentLocalDate, currentTimeZone } = readDeviceLocalDateState();
      const entries = toWidgetTimelineEntries(snapshot, {
        now: currentLocalDate,
        timeZone: currentTimeZone,
        appScheme,
      });

      for (const { widget } of AIDO_WIDGETS) {
        widget.updateTimeline(entries);
      }
    },
  };
}
