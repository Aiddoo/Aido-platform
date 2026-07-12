import type { SyncStorage } from '@src/core/ports/sync-storage';

import { type WidgetSnapshot, widgetSnapshotSchema } from '../models/widget-snapshot.model';

/**
 * 위젯 스냅샷 로컬 영속화 (Repository 패턴 예외 — HTTP가 아닌 로컬 스토리지).
 *
 * Android headless task handler가 시스템 갱신 시점에 읽는 저장소다.
 * iOS는 expo-widgets가 App Group에 타임라인을 직접 저장하므로 이 저장소를 쓰지 않는다.
 */
export interface WidgetSnapshotRepository {
  read(): WidgetSnapshot | null;
  write(snapshot: WidgetSnapshot): void;
  clear(): void;
}

const KEY = 'aido_widget_snapshot_v1';

export class WidgetSnapshotRepositoryImpl implements WidgetSnapshotRepository {
  readonly #storage: SyncStorage;

  constructor(storage: SyncStorage) {
    this.#storage = storage;
  }

  read(): WidgetSnapshot | null {
    const raw = this.#storage.getString(KEY);
    if (raw === undefined) {
      return null;
    }

    try {
      const parsed = widgetSnapshotSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      // 손상된 JSON은 스냅샷 없음으로 취급 — 위젯은 빈 상태를 렌더한다
      return null;
    }
  }

  write(snapshot: WidgetSnapshot): void {
    this.#storage.set(KEY, JSON.stringify(snapshot));
  }

  clear(): void {
    this.#storage.delete(KEY);
  }
}
