import type { WidgetSnapshot } from '../models/widget-snapshot.model';

/**
 * 플랫폼 위젯 IO 포트.
 *
 * 구현체: expo-widgets(iOS 타임라인) · react-native-android-widget(Android 렌더) · noop(웹).
 * 앱 → 위젯 단방향 쓰기만 존재한다(위젯은 순수 렌더러).
 */
export interface WidgetBridge {
  /** 스냅샷을 플랫폼 위젯 저장소에 기록하고 위젯 갱신을 요청한다. */
  writeSnapshot(snapshot: WidgetSnapshot): Promise<void>;
}
