import type { WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';

export interface WidgetBridge {
  /** userId는 스냅샷 주인. 로그아웃 스냅샷처럼 주인이 없으면 null이다 */
  writeSnapshot(snapshot: WidgetSnapshot, userId: string | null): Promise<void>;
}
