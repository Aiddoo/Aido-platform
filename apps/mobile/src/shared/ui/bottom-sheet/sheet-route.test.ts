import { exitSheetRoute, type SheetRouteNavigator } from './sheet-route';

function createNavigator(canGoBack: boolean): jest.Mocked<SheetRouteNavigator> {
  return { canGoBack: jest.fn(() => canGoBack), back: jest.fn(), replace: jest.fn() };
}

describe('시트 route 나가기', () => {
  it('돌아갈 화면이 있으면 시트 route만 닫는다', () => {
    // Given
    const navigator = createNavigator(true);

    // When
    exitSheetRoute(navigator, { type: 'back' }, '/feed');

    // Then
    expect(navigator.back).toHaveBeenCalledTimes(1);
    expect(navigator.replace).not.toHaveBeenCalled();
  });

  it('딥링크로 바로 열려 돌아갈 화면이 없으면 부모 화면으로 바꾼다', () => {
    // Given
    const navigator = createNavigator(false);

    // When
    exitSheetRoute(navigator, { type: 'back' }, '/feed');

    // Then
    expect(navigator.back).not.toHaveBeenCalled();
    expect(navigator.replace).toHaveBeenCalledWith('/feed');
  });

  it('다음 시트로 이어지면 뒤로가기 기록을 쌓지 않고 바꾼다', () => {
    // Given
    const navigator = createNavigator(true);
    const next = { pathname: '/todo/[todoId]/edit', params: { todoId: '1' } } as const;

    // When
    exitSheetRoute(navigator, { type: 'replace', href: next }, '/feed');

    // Then
    expect(navigator.back).not.toHaveBeenCalled();
    expect(navigator.replace).toHaveBeenCalledWith(next);
  });

  it('완료 후 다른 화면으로 가야 하면 시트를 닫은 뒤 아래 화면을 바꾼다', () => {
    // Given
    const navigator = createNavigator(true);

    // When
    exitSheetRoute(navigator, { type: 'back-then-replace', href: '/feed' }, '/suggestions');

    // Then
    expect(navigator.back).toHaveBeenCalledTimes(1);
    expect(navigator.replace).toHaveBeenCalledWith('/feed');
    expect(navigator.back.mock.invocationCallOrder[0]).toBeLessThan(
      navigator.replace.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
