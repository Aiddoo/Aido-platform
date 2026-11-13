import { stubWindowDimensions } from '@src/testing/core';
import { IPAD_SIDEBAR_WIDTH } from '@src/testing/window-layout.fixtures';
import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import type * as SafeArea from 'react-native-safe-area-context';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AdaptivePane } from './adaptive-pane';
import { PaneArea } from './pane-area';

function renderPane(width: number) {
  stubWindowDimensions(width);
  return render(<AdaptivePane primary={<Text>목록</Text>} secondary={<Text>상세</Text>} />);
}

describe('AdaptivePane 컴포넌트', () => {
  it('compact에서는 목록만 렌더링한다', async () => {
    // When
    await renderPane(390);

    // Then
    expect(screen.getByText('목록')).toBeTruthy();
    expect(screen.queryByText('상세')).toBeNull();
  });

  it('접기·펼치기로 size class가 바뀌어도 목록 pane을 다시 마운트하지 않는다', async () => {
    // Given
    const onMount = jest.fn();
    function MountProbe({ label }: { label: string }) {
      useEffect(() => {
        onMount(label);
      }, [label]);
      return <Text>{label}</Text>;
    }
    const createPane = () => (
      <AdaptivePane primary={<MountProbe label="목록" />} secondary={<MountProbe label="상세" />} />
    );
    stubWindowDimensions(390);
    const { rerender } = await render(createPane());

    // When
    stubWindowDimensions(900);
    await rerender(createPane());
    stubWindowDimensions(390);
    await rerender(createPane());

    // Then
    expect(onMount.mock.calls).toEqual([['목록'], ['상세']]);
  });

  it('iPad 탭 사이드바가 열려 왼쪽 inset이 생기면 창이 넓어도 목록만 그리고 목록은 다시 마운트하지 않는다', async () => {
    // Given
    const onMount = jest.fn();
    function MountProbe({ label }: { label: string }) {
      useEffect(() => {
        onMount(label);
      }, [label]);
      return <Text>{label}</Text>;
    }
    const createPane = () => (
      <PaneArea>
        <AdaptivePane
          primary={<MountProbe label="목록" />}
          secondary={<MountProbe label="상세" />}
        />
      </PaneArea>
    );
    stubWindowDimensions(820, 1180);
    let sidebarWidth = 0;
    // 탭이 잰 값을 넘긴다. iPadOS 26+ 사이드바는 탭 폭을 줄이지 않고 왼쪽 inset으로 온다
    jest
      .spyOn(
        jest.requireMock<typeof SafeArea>('react-native-safe-area-context'),
        'SafeAreaProvider',
      )
      .mockImplementation(({ children }) => (
        <SafeAreaFrameContext value={{ x: 0, y: 0, width: 820, height: 1180 }}>
          <SafeAreaInsetsContext value={{ top: 0, right: 0, bottom: 0, left: sidebarWidth }}>
            {children}
          </SafeAreaInsetsContext>
        </SafeAreaFrameContext>
      ));
    const { rerender } = await render(createPane());
    expect(screen.getByText('상세')).toBeTruthy();

    // When
    sidebarWidth = IPAD_SIDEBAR_WIDTH;
    await rerender(createPane());

    // Then
    expect(screen.queryByText('상세')).toBeNull();
    expect(onMount.mock.calls).toEqual([['목록'], ['상세']]);
  });

  it('펼친 pane은 첫 프레임부터 자기가 닿는 가장자리의 창 inset만 받는다', async () => {
    // Given
    function InsetsProbe({ label }: { label: string }) {
      const { right } = useSafeAreaInsets();
      return <Text>{`${label}:${right}`}</Text>;
    }
    stubWindowDimensions(900);

    // When
    await render(
      <SafeAreaInsetsContext value={{ top: 0, right: 84, bottom: 34, left: 0 }}>
        <AdaptivePane
          primary={<InsetsProbe label="목록" />}
          secondary={<InsetsProbe label="상세" />}
        />
      </SafeAreaInsetsContext>,
    );

    // Then
    expect(screen.getByText('목록:0')).toBeTruthy();
    expect(screen.getByText('상세:84')).toBeTruthy();
  });
});
