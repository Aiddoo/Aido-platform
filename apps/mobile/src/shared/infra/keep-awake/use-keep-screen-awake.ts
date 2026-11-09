import { useKeepAwake } from 'expo-keep-awake';

/** Android는 Activity가 사라진 뒤 풀면 거절한다. 켜둘 화면이 이미 없으니 알릴 일이 아니다 */
const KEEP_AWAKE_OPTIONS = { suppressDeactivateWarnings: true };

export function useKeepScreenAwake() {
  useKeepAwake(undefined, KEEP_AWAKE_OPTIONS);
}
