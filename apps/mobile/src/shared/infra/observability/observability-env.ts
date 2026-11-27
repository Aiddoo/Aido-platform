import type { Analytics } from '@src/core/ports/analytics';
import type { AppLogger } from '@src/core/ports/app-logger';
import { ENV } from '@src/shared/config/env';

import {
  createConsoleAnalytics,
  createFirebaseAnalytics,
  markFirebaseTrafficAsInternal,
} from '../analytics';

/** 어댑터 선택은 `ENV.TELEMETRY`(env.ts)를 따른다. 앱 트리와 위젯 headless가 같은 규칙을 공유하며, 오류 보고기는 firebase를 끌어오지 않도록 `error-reporter`에 따로 둔다 */
export function createEnvironmentAnalytics(logger: AppLogger): Analytics {
  if (ENV.TELEMETRY.usesVendorAdapters) {
    return createFirebaseAnalytics(logger);
  }
  // JS 이벤트는 콘솔로만 남기고, 네이티브 자동 수집 이벤트는 내부 트래픽으로 표시해 운영 지표에서 뺀다
  markFirebaseTrafficAsInternal(logger);
  return createConsoleAnalytics();
}
