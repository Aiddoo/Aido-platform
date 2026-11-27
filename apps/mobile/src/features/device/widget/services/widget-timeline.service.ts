import type { Instant } from '@src/shared/date/instant';

import { toWidgetTimelineEntries } from '../apis/widget-timeline.mapper';
import { AIDO_WIDGETS } from '../components/widgets';
import type { StoredWidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import type { WidgetBridge } from './widget-sync.service';

interface WidgetTimelinePorts {
  now: () => Instant;
  /** LocalDateProvider와 같은 기기 시간대. 자정 경계를 이 시간대로 계산한다 */
  readTimezone: (now: Instant) => string;
  appScheme: string;
}

export class WidgetTimelineService implements WidgetBridge {
  readonly #ports: WidgetTimelinePorts;

  constructor(ports: WidgetTimelinePorts) {
    this.#ports = ports;
  }

  writeSnapshot = async (snapshot: StoredWidgetSnapshot): Promise<void> => {
    const now = this.#ports.now();
    const entries = toWidgetTimelineEntries(snapshot, {
      now,
      timezone: this.#ports.readTimezone(now),
      appScheme: this.#ports.appScheme,
    });

    for (const { widget } of AIDO_WIDGETS) {
      widget.updateTimeline(entries);
    }
  };
}
