import { formatDate } from '@src/shared/utils/date';
import { Platform } from 'react-native';

import { type WidgetSnapshot, WidgetSnapshotPolicy } from '../models/widget-snapshot.model';
import { aidoWidgets } from '../presentations/widgets';
import { toWidgetProps } from '../services/widget-props.mapper';
import type { WidgetBridge } from './widget-bridge';

function nextLocalMidnight(now: Date): Date {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

export function createExpoWidgetsBridge(): WidgetBridge {
  return {
    async writeSnapshot(snapshot: WidgetSnapshot): Promise<void> {
      const now = new Date();
      const localDate = formatDate(now);
      const currentProps = toWidgetProps(
        snapshot,
        WidgetSnapshotPolicy.renderState(snapshot, localDate),
      );

      if (Platform.OS === 'android') {
        for (const { widget, maxRows } of aidoWidgets) {
          widget.updateSnapshot({ ...currentProps, maxRows });
        }
        return;
      }

      const entries =
        snapshot.state === 'loggedOut'
          ? [{ date: now, props: currentProps }]
          : [
              { date: now, props: currentProps },
              { date: nextLocalMidnight(now), props: toWidgetProps(snapshot, 'stale') },
            ];

      for (const { widget } of aidoWidgets) {
        widget.updateTimeline(entries);
      }
    },
  };
}
