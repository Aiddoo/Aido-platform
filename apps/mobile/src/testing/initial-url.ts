import { Linking } from 'react-native';

/** 앱을 처음 연 링크(`Linking.getInitialURL`)를 정한다. 기본은 링크 없이 연 실행이다. spy라 `restoreMocks`가 되돌린다 */
export function stubInitialUrl(url: string | null = null) {
  return jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
}
