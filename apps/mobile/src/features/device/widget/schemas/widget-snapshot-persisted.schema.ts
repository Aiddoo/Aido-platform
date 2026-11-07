import { omit } from 'es-toolkit';
import { z } from 'zod';

import {
  type WidgetSnapshot,
  widgetDaySnapshotSchema,
  widgetSnapshotSchema,
} from './widget-snapshot.schema';

const legacyWidgetSnapshotV1Schema = widgetDaySnapshotSchema.extend({
  version: z.literal(1),
  updatedAtIso: z.string(),
});

/** 저장소에서 읽을 때만 사용한다. 이미 저장된 v1은 하루짜리 v2로 읽는다. */
export const storedWidgetSnapshotSchema = z.union([
  widgetSnapshotSchema,
  legacyWidgetSnapshotV1Schema.transform((legacy): WidgetSnapshot => ({
    version: 2,
    updatedAtIso: legacy.updatedAtIso,
    days: [omit(legacy, ['version', 'updatedAtIso'])],
  })),
]);
