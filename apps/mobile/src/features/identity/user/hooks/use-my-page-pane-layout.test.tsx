import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';

import { createMyPagePaneLayoutStore } from '../stores/my-page-pane-layout.store';
import { useMyPagePaneLayout } from './use-my-page-pane-layout';

function createScrollEvent(y: number) {
  return { nativeEvent: { contentOffset: { x: 0, y } } };
}

/** Android ScrollView처럼 내용 높이를 넘는 위치를 잘라 스크롤 이벤트로 알리는 가짜 */
function createClampingScrollView(getMaxOffset: () => number, onScrolled: (y: number) => void) {
  return {
    scrollTo: jest.fn(({ y }: { y: number }) => {
      onScrolled(Math.min(y, getMaxOffset()));
    }),
  };
}

/** 칸마다 따로 그려도 앱처럼 컨테이너의 저장소 하나를 함께 쓴다 */
let paneLayoutStore = createMyPagePaneLayoutStore();

beforeEach(() => {
  paneLayoutStore = createMyPagePaneLayoutStore();
});

async function renderPane() {
  const view = await renderScreenHook(() => useMyPagePaneLayout(), {
    di: { myPagePaneLayoutStore: paneLayoutStore },
  });
  let maxOffset = 0;
  let offset = 0;
  const scrollView = createClampingScrollView(
    () => maxOffset,
    (y) => {
      offset = y;
      view.result.current.handleScrollEnd(createScrollEvent(y));
    },
  );
  Object.assign(view.result.current.scrollRef, { current: scrollView });

  return {
    view,
    scrollView,
    getOffset: () => offset,
    growContent: (next: number) => {
      maxOffset = next;
      view.result.current.handleSizeChange();
    },
    userScrollTo: (y: number) => {
      view.result.current.handleScrollBeginDrag();
      offset = y;
      view.result.current.handleScrollEnd(createScrollEvent(y));
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
    // 내 정보 칸을 300까지 내렸고 메뉴 칸이 위에 떠 있다
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);

    // When
    // 회전으로 아래 칸의 내용이 줄어 위치가 잘린다
    tabPane.view.result.current.handleScrollEnd(createScrollEvent(40));

    // Then
    // 돌아오면 저장된 위치로 간다
    await focus(tabPane);
    expect(tabPane.getOffset()).toBe(300);
  });

  it('내용이 짧아 잘린 스크롤은 저장값을 덮지 않고, 내용이 자라면 그 위치로 다시 간다', async () => {
    // Given
    // 내 정보 칸을 300까지 내렸다
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);

    // When
    // 메뉴 칸이 뜨고 내용이 아직 스켈레톤 높이일 때 복원한다
    jest.mocked(useIsFocused).mockReturnValue(false);
    const menuPane = await renderPane();
    await menuPane.growContent(40);
    await focus(menuPane);

    // Then
    // 잘린 위치에 머물다가 내용이 자라면 저장된 위치로 간다
    expect(menuPane.getOffset()).toBe(40);
    await menuPane.growContent(1000);
    expect(menuPane.getOffset()).toBe(300);

    // Then
    // 내 정보 칸으로 돌아와도 같은 위치다
    await blur(menuPane);
    await focus(tabPane);
    expect(tabPane.getOffset()).toBe(300);
  });

  it('복원을 끝낸 뒤 내용이 다시 바뀌어도 사용자가 스크롤한 위치로 끌고 가지 않는다', async () => {
    // Given
    // 복원이 끝난 칸이다
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);
    await focus(tabPane);
    tabPane.scrollView.scrollTo.mockClear();

    // When
    // 사용자가 스크롤한 뒤 내용 높이가 바뀐다
    await tabPane.userScrollTo(120);
    await tabPane.growContent(1200);

    // Then
    // 다시 스크롤하지 않는다
    expect(tabPane.scrollView.scrollTo).not.toHaveBeenCalled();
  });

  it('복원을 기다리는 중에 사용자가 끌면 복원을 멈추고 끈 위치를 저장한다', async () => {
    // Given
    // 저장된 위치까지 내용이 아직 자라지 않았다
    const tabPane = await renderPane();
    await tabPane.growContent(1000);
    await tabPane.userScrollTo(300);
    await blur(tabPane);
    jest.mocked(useIsFocused).mockReturnValue(false);
    const menuPane = await renderPane();
    await menuPane.growContent(40);
    await focus(menuPane);

    // When
    // 사용자가 끈다
    await menuPane.userScrollTo(10);
    await menuPane.growContent(1000);

    // Then
    // 끈 위치를 그대로 둔다
    expect(menuPane.getOffset()).toBe(10);
    await blur(menuPane);
    await focus(tabPane);
    expect(tabPane.getOffset()).toBe(10);
  });
});
