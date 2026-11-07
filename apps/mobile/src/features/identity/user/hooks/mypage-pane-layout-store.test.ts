import { createMyPagePaneLayoutStore } from './mypage-pane-layout-store';

describe('마이페이지 메뉴 칸 저장소', () => {
  it('두 화면의 위 여백 중 큰 값을 유지하고 커질 때만 알린다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    store.publishTopInset(50);
    store.publishTopInset(20);

    // Then
    expect(store.getTopInset()).toBe(50);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('칸 하나가 사라져도 남은 칸이 있으면 스크롤을 유지한다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    store.subscribe(jest.fn());
    const unsubscribeMenu = store.subscribe(jest.fn());
    store.setScrollOffset(120);

    // When
    unsubscribeMenu();

    // Then
    expect(store.getScrollOffset()).toBe(120);
  });

  it('칸이 모두 사라지면 다음 로그인을 위해 비운다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    const unsubscribe = store.subscribe(jest.fn());
    store.setScrollOffset(120);
    store.publishTopInset(50);

    // When
    unsubscribe();

    // Then
    expect(store.getScrollOffset()).toBe(0);
    expect(store.getTopInset()).toBe(0);
  });
});
