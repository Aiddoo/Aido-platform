import { getMyPageDetailOptions } from './my-page-detail-options';

function createInput(routeKey: string, stackKeys: string[]) {
  return {
    route: { key: routeKey, name: routeKey },
    navigation: { getState: () => ({ routes: stackKeys.map((key) => ({ key })) }) },
  };
}

describe('getMyPageDetailOptions', () => {
  it('첫 상세는 뒤로 가기·스와이프 없이 바로 바꾼다', () => {
    // Given
    const input = createInput('theme', ['menu', 'theme']);

    // When
    const options = getMyPageDetailOptions(input);

    // Then
    expect(options).toEqual({ headerBackVisible: false, gestureEnabled: false, animation: 'none' });
  });

  it('두 번째 단계부터는 네이티브 뒤로 가기를 두고 메뉴 칸이 밀리지 않게 겹쳐 바꾼다', () => {
    // Given
    const input = createInput('search', ['menu', 'friends', 'search']);

    // When
    const options = getMyPageDetailOptions(input);

    // Then
    expect(options).toEqual({ animation: 'fade', animationMatchesGesture: true });
  });

  it('Stack 첫 화면은 바꾸지 않는다', () => {
    // Given
    const input = createInput('menu', ['menu']);

    // When
    const options = getMyPageDetailOptions(input);

    // Then
    expect(options).toEqual({});
  });
});
