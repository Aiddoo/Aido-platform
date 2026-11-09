import type { WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';

export interface WidgetBridge {
  writeSnapshot(snapshot: WidgetSnapshot, userId?: string | null): Promise<void>;
}
