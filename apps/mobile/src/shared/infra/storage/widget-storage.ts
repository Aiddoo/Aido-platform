import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { noop } from 'es-toolkit';

export const widgetStorage: ObservableSyncStorage = {
  get: () => undefined,
  set: noop,
  remove: noop,
  subscribe: () => noop,
};
