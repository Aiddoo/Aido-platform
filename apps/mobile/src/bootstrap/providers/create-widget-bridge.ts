import type { WidgetBridge } from '@src/features/device/widget/services/widget-sync.service';
import { asyncNoop } from 'es-toolkit';

/** 위젯 미지원 플랫폼(web 등)용 no-op 브리지. iOS·Android는 플랫폼 파일이 Metro 그래프를 나눈다 */
export function createWidgetBridge(): WidgetBridge {
  return { writeSnapshot: asyncNoop };
}
