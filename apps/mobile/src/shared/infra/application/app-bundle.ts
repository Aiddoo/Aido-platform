import { reloadAppAsync } from 'expo';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

/** OTA 업데이트까지 가르는 설치 번들의 id. 네이티브 버전과 OTA 번들 id를 잇는다 */
export function getAppBundleId(): string {
  return `${Application.nativeApplicationVersion}+${Updates.updateId ?? 'embedded'}`;
}

/** OTA가 켜져 있으면 받아 둔 업데이트로, 아니면(개발 빌드) 같은 번들로 다시 띄운다 */
export function reloadApp(): Promise<void> {
  return Updates.isEnabled ? Updates.reloadAsync() : reloadAppAsync();
}
