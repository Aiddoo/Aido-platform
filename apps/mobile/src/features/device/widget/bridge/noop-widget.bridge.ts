import type { WidgetBridge } from './widget-bridge';

/** 위젯 미지원 플랫폼(web 등)용 no-op 브리지 */
export function createNoopWidgetBridge(): WidgetBridge {
  return {
    writeSnapshot: async () => {},
  };
}
