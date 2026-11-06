import type { WidgetSnapshot } from '../schemas/widget-snapshot.schema';

export interface WidgetBridge {
  writeSnapshot(snapshot: WidgetSnapshot, userId?: string | null): Promise<void>;
}
