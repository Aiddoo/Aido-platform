import { type ScreenName, toScreenName } from '@src/shared/utils/to-screen-name';
import { useSegments } from 'expo-router';

/** 지금 화면의 라우트 템플릿. 화면 조회·탭 전환·오류 재시도 이벤트가 같은 이름을 쓴다 */
export function useScreenName(): ScreenName {
  return toScreenName(useSegments());
}
