import { readDeviceLocalDateState } from '@src/shared/utils/local-date-clock';
import Constants from 'expo-constants';

import { toWidgetTimelineEntries } from '../apis/widget-timeline.mapper';
import { AIDO_WIDGETS } from '../components/widgets';
import type { WidgetSnapshot } from '../domains/widget-snapshot.model';
import type { WidgetBridge } from './widget-bridge';

export function createExpoWidgetsBridge(): WidgetBridge {
  const scheme = Constants.expoConfig?.scheme;
  const appScheme = typeof scheme === 'string' ? scheme : (scheme?.[0] ?? 'aido');
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
