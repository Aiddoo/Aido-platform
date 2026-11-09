import { getSplitDetailRootOptions } from './get-split-detail-root-options';

function createInput(routeKey: string, stackKeys: string[]) {
  return {
    route: { key: routeKey },
    navigation: { getState: () => ({ routes: stackKeys.map((key) => ({ key })) }) },
  };
}

describe('getSplitDetailRootOptions', () => {
  it('오른쪽 칸 첫 상세는 뒤로 가기·스와이프 없이 칸만 바꾼다', () => {
    // Given
    const input = createInput('theme', ['menu', 'theme']);

    // When
    const options = getSplitDetailRootOptions(input);

    // Then
    expect(options).toEqual({ headerBackVisible: false, gestureEnabled: false, animation: 'none' });
  });

  it('두 번째 단계부터는 네이티브 뒤로 가기를 그대로 둔다', () => {
    // Given
    const input = createInput('search', ['menu', 'friends', 'search']);

    // When
    const options = getSplitDetailRootOptions(input);

    // Then
    expect(options).toEqual({});
  });

  it('비어 있는 칸(Stack 첫 화면)은 바꾸지 않는다', () => {
    // Given
    const input = createInput('menu', ['menu']);

    // When
    const options = getSplitDetailRootOptions(input);

    // Then
    expect(options).toEqual({});
  });
});
