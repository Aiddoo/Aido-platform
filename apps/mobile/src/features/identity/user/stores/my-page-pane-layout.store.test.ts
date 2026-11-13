import { createMyPagePaneLayoutStore } from './my-page-pane-layout.store';

describe('createMyPagePaneLayoutStore', () => {
  it('칸 하나가 사라져도 남은 칸이 있으면 스크롤을 유지한다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    store.attach();
    const detachMenu = store.attach();
    store.setScrollOffset(120);

    // When
    detachMenu();

    // Then
    expect(store.getScrollOffset()).toBe(120);
  });

  it('칸이 모두 사라지면 다음 로그인을 위해 비운다', () => {
    // Given
    const store = createMyPagePaneLayoutStore();
    const detach = store.attach();
    store.setScrollOffset(120);

    // When
    detach();

    // Then
    expect(store.getScrollOffset()).toBe(0);
  });
});
