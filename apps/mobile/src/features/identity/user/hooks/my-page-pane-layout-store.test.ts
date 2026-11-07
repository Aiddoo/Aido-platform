import { createMyPagePaneLayoutStore } from './my-page-pane-layout-store';

describe('마이페이지 메뉴 칸 저장소', () => {
  it('떠 있는 칸의 위 여백 중 큰 값을 쓰고 값이 바뀔 때만 알린다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    store.publishTopInset('tab', 50);
    store.publishTopInset('menu', 20);

    // Then
    expect(store.getTopInset()).toBe(50);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('회전이나 접기로 위 inset이 줄면 위 여백도 줄어든다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.publishTopInset('tab', 50);

    // When
    store.publishTopInset('tab', 24);

    // Then
    expect(store.getTopInset()).toBe(24);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('위 쪽 탭 바가 있는 칸이 사라지면 남은 칸의 값으로 돌아간다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    store.subscribe(jest.fn());
    store.publishTopInset('tab', 74);
    store.publishTopInset('menu', 24);

    // When
    store.removeTopInset('tab');

    // Then
    expect(store.getTopInset()).toBe(24);
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
    store.publishTopInset('tab', 50);

    // When
    unsubscribe();

    // Then
    expect(store.getScrollOffset()).toBe(0);
    expect(store.getTopInset()).toBe(0);
  });
});
