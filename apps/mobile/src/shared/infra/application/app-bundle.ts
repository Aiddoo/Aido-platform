import { reloadAppAsync } from 'expo';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

/** 네이티브 버전과 OTA 번들 id를 잇는다 */
export function getAppBundleId(): string {
  return `${Application.nativeApplicationVersion ?? 'unknown'}+${Updates.updateId ?? 'embedded'}`;
}

/** OTA가 꺼진 개발 빌드는 같은 번들로 다시 띄운다 */
export function reloadApp(): Promise<void> {
  return Updates.isEnabled ? Updates.reloadAsync() : reloadAppAsync();
}
