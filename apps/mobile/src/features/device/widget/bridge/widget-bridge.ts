import type { WidgetSnapshot } from '../domains/widget-snapshot.model';

export interface WidgetBridge {
  writeSnapshot(snapshot: WidgetSnapshot, userId?: string | null): Promise<void>;
}
