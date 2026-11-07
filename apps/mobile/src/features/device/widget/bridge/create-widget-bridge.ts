import { asyncNoop } from 'es-toolkit';

import type { WidgetBridge } from './widget-bridge';

/** 위젯 미지원 플랫폼(web 등)용 no-op 브리지 */
export function createWidgetBridge(): WidgetBridge {
  return { writeSnapshot: asyncNoop };
}
