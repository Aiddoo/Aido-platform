import { useKeepAwake } from 'expo-keep-awake';

/** Android는 Activity가 사라진 뒤 풀면 거절한다. 켜둘 화면이 이미 없으니 알릴 일이 아니다 */
const KEEP_AWAKE_OPTIONS = { suppressDeactivateWarnings: true };

/** 이 훅을 쓰는 화면이 떠 있는 동안 화면이 꺼지지 않는다. 라이브러리 자체가 React 훅이라 경계 훅으로 둔다 */
export function useKeepScreenAwake() {
  useKeepAwake(undefined, KEEP_AWAKE_OPTIONS);
}
