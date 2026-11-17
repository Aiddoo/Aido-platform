import type { ENV } from '@src/shared/config/env';

type AppEnv = typeof ENV.APP_ENV;

/** 에뮬레이터·시뮬레이터에서 돈 출시 빌드 QA 이벤트는 환경을 나눠 운영 알림에서 뺀다. Mac에서 도는 iOS 앱은 실기기다 */
export function toSentryEnvironment(
  appEnv: AppEnv,
  isPhysicalDevice: boolean,
): AppEnv | `${AppEnv}-emulator` {
  if (isPhysicalDevice) {
    return appEnv;
  }
  return `${appEnv}-emulator`;
}
