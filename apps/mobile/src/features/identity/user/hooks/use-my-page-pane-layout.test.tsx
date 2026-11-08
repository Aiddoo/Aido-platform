import { act, renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';

import { useMyPagePaneLayout } from './use-my-page-pane-layout';

function createScrollEvent(y: number) {
  return { nativeEvent: { contentOffset: { x: 0, y } } };
}

function createClampingScrollView(getMaxOffset: () => number, onScrolled: (y: number) => void) {
  return {
    scrollTo: jest.fn(({ y }: { y: number }) => {
      onScrolled(Math.min(y, getMaxOffset()));
    }),
  };
}

async function renderPane() {
  const view = await renderHook(() => useMyPagePaneLayout());
  let maxOffset = 0;
  let offset = 0;
  const scrollView = createClampingScrollView(
    () => maxOffset,
    (y) => {
      offset = y;
      view.result.current.handleScroll(createScrollEvent(y));
    },
  );
  Object.assign(view.result.current.scrollRef, { current: scrollView });

  return {
    view,
    scrollView,
    getOffset: () => offset,
    growContent: (next: number) => {
      maxOffset = next;
      view.result.current.handleContentSizeChange();
    },
    userScrollTo: (y: number) => {
      view.result.current.handleScrollBeginDrag();
      offset = y;
      view.result.current.handleScroll(createScrollEvent(y));
    },
  };
}

async function focus(pane: Awaited<ReturnType<typeof renderPane>>) {
  jest.mocked(useIsFocused).mockReturnValue(true);
  await act(async () => pane.view.rerender({}));
}

async function blur(pane: Awaited<ReturnType<typeof renderPane>>) {
  jest.mocked(useIsFocused).mockReturnValue(false);
  await act(async () => pane.view.rerender({}));
}

describe('useMyPagePaneLayout 스크롤 복원', () => {
  it('포커스를 잃은 칸의 잘린 스크롤은 저장값을 덮지 않는다', async () => {
    // Given
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);

    // When
    tabPane.view.result.current.handleScroll(createScrollEvent(40));

    // Then
    await focus(tabPane);
    expect(tabPane.getOffset()).toBe(300);
  });

  it('내용이 짧아 잘린 스크롤은 저장값을 덮지 않고, 내용이 자라면 그 위치로 다시 간다', async () => {
    // Given
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);

    // When
    jest.mocked(useIsFocused).mockReturnValue(false);
    const menuPane = await renderPane();
    await menuPane.growContent(40);
    await focus(menuPane);

    // Then
    expect(menuPane.getOffset()).toBe(40);
    await menuPane.growContent(1000);
    expect(menuPane.getOffset()).toBe(300);

    // Then
    await blur(menuPane);
    await focus(tabPane);
    expect(tabPane.getOffset()).toBe(300);
  });

  it('복원을 끝낸 뒤 내용이 다시 바뀌어도 사용자가 스크롤한 위치로 끌고 가지 않는다', async () => {
    // Given
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);
    await focus(tabPane);
    tabPane.scrollView.scrollTo.mockClear();

    // When
    await tabPane.userScrollTo(120);
    await tabPane.growContent(1200);

    // Then
    expect(tabPane.scrollView.scrollTo).not.toHaveBeenCalled();
  });

  it('복원을 기다리는 중에 사용자가 끌면 복원을 멈추고 끈 위치를 저장한다', async () => {
    // Given
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);
    jest.mocked(useIsFocused).mockReturnValue(false);
    const menuPane = await renderPane();
    await menuPane.growContent(40);
    await focus(menuPane);

    // When
    await menuPane.userScrollTo(10);
    await menuPane.growContent(1000);

    // Then
    expect(menuPane.getOffset()).toBe(10);
    await blur(menuPane);
    await focus(tabPane);
    expect(tabPane.getOffset()).toBe(10);
  });
});
