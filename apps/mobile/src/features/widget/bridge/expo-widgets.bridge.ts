import { formatDate } from '@src/shared/utils/date';
import Constants from 'expo-constants';

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
  const scheme = Constants.expoConfig?.scheme;
  const appScheme = typeof scheme === 'string' ? scheme : (scheme?.[0] ?? 'aido');
  return {
    async writeSnapshot(snapshot: WidgetSnapshot): Promise<void> {
      const now = new Date();
      const localDate = formatDate(now);
      const currentProps = toWidgetProps(
        snapshot,
        WidgetSnapshotPolicy.renderState(snapshot, localDate),
        appScheme,
      );

      const entries =
        snapshot.state === 'loggedOut'
          ? [{ date: now, props: currentProps }]
          : [
              { date: now, props: currentProps },
              { date: nextLocalMidnight(now), props: toWidgetProps(snapshot, 'stale', appScheme) },
            ];

      for (const { widget } of aidoWidgets) {
        widget.updateTimeline(entries);
      }
    },
  };
}
