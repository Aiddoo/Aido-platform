import type { WidgetSnapshot } from '../models/widget-snapshot.model';

export interface WidgetBridge {
  writeSnapshot(snapshot: WidgetSnapshot, userId?: string | null): Promise<void>;
}
