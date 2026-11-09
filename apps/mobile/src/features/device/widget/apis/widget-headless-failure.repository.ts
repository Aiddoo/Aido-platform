import type { SyncStorage } from '@src/core/ports/sync-storage';
import { toError } from '@src/shared/errors';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import {
  type WidgetHeadlessFailure,
  widgetHeadlessFailureSchema,
} from '../schemas/widget-headless-failure-storage.schema';

const WIDGET_HEADLESS_FAILURE_KEY = 'aido_widget_headless_failure_v1';

interface SaveWidgetHeadlessFailureInput {
  method: string;
  error: unknown;
}

export interface WidgetHeadlessFailureRepository {
  save(input: SaveWidgetHeadlessFailureInput): void;
  /** 남아 있는 실패를 꺼내며 지운다. 없으면 null이다 */
  take(): WidgetHeadlessFailure | null;
}

export function createWidgetHeadlessFailureRepository(
  storage: SyncStorage,
): WidgetHeadlessFailureRepository {
  return {
    save: ({ method, error }) => {
      const { name, message } = toError(error);
      storage.set(WIDGET_HEADLESS_FAILURE_KEY, JSON.stringify({ method, name, message }));
    },
    take: () => {
      const failure = parseStoredJson(
        storage.get(WIDGET_HEADLESS_FAILURE_KEY),
        widgetHeadlessFailureSchema,
      );
      storage.remove(WIDGET_HEADLESS_FAILURE_KEY);
      return failure;
    },
  };
}
