import { mockWindowDimensions } from '@src/shared/__tests__';
import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptivePane } from './adaptive-pane';

function renderPane(width: number) {
  mockWindowDimensions(width);
  return render(<AdaptivePane primary={<Text>목록</Text>} secondary={<Text>상세</Text>} />);
}

describe('AdaptivePane 컴포넌트', () => {
  it('compact에서는 목록만 렌더링한다', async () => {
    await renderPane(390);

    expect(screen.getByText('목록')).toBeTruthy();
    expect(screen.queryByText('상세')).toBeNull();
  });

  it('medium에서는 목록과 상세를 함께 렌더링하고 목록 폭을 320으로 둔다', async () => {
    await renderPane(700);

    expect(screen.getByText('상세')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('adaptive-pane-primary').props.style)).toEqual({
      width: 320,
    });
  });

  it('expanded에서는 목록 폭을 400으로 둔다', async () => {
    await renderPane(900);

    expect(StyleSheet.flatten(screen.getByTestId('adaptive-pane-primary').props.style)).toEqual({
      width: 400,
    });
  });

  it('compactPane이 secondary면 compact에서 상세만 렌더링한다', async () => {
    mockWindowDimensions(390);
    await render(
      <AdaptivePane
        primary={<Text>목록</Text>}
        secondary={<Text>상세</Text>}
        compactPane="secondary"
      />,
    );

    expect(screen.queryByText('목록')).toBeNull();
    expect(screen.getByText('상세')).toBeTruthy();
  });

  it('접기·펼치기로 size class가 바뀌어도 남아 있는 pane을 다시 마운트하지 않는다', async () => {
    const onMount = jest.fn();
    function MountProbe({ label }: { label: string }) {
      useEffect(() => {
        onMount(label);
      }, [label]);
      return <Text>{label}</Text>;
    }
    const createPane = () => (
      <AdaptivePane
        primary={<MountProbe label="목록" />}
        secondary={<MountProbe label="상세" />}
        compactPane="secondary"
      />
    );
    mockWindowDimensions(390);
    const { rerender } = await render(createPane());

    mockWindowDimensions(900);
    await rerender(createPane());
    mockWindowDimensions(390);
    await rerender(createPane());

    expect(onMount.mock.calls).toEqual([['상세'], ['목록']]);
  });

  it('펼친 pane은 첫 프레임부터 자기가 닿는 가장자리의 창 inset만 받는다', async () => {
    function InsetsProbe({ label }: { label: string }) {
      const { right } = useSafeAreaInsets();
      return <Text>{`${label}:${right}`}</Text>;
    }
    mockWindowDimensions(900);
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 84, bottom: 34, left: 0 }}>
        <AdaptivePane
          primary={<InsetsProbe label="목록" />}
          secondary={<InsetsProbe label="상세" />}
        />
      </SafeAreaInsetsContext.Provider>,
    );

    expect(screen.getByText('목록:0')).toBeTruthy();
    expect(screen.getByText('상세:84')).toBeTruthy();
  });
});
