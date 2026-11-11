import { Box } from '@src/shared/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useLayoutSize } from './use-layout-size';

interface LayoutSize {
  width: number;
  height: number;
}

function LayoutProbe({ onRender }: { onRender: (size: LayoutSize) => void }) {
  const [size, handleLayout] = useLayoutSize();
  onRender(size);
  return <Box testID="probe" onLayout={handleLayout} />;
}

function layoutEvent(width: number, height: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height } } };
}

describe('useLayoutSize', () => {
  it('같은 크기로 다시 재면 앞의 크기 객체를 그대로 돌려줘 크기를 받는 자식이 다시 그려지지 않는다', async () => {
    // Given
    const renders: LayoutSize[] = [];
    await render(<LayoutProbe onRender={(size) => renders.push(size)} />);
    await fireEvent(screen.getByTestId('probe'), 'layout', layoutEvent(320, 48));
    const measured = renders.at(-1);

    // When
    await fireEvent(screen.getByTestId('probe'), 'layout', layoutEvent(320, 48));

    // Then
    expect(measured).toEqual({ width: 320, height: 48 });
    expect(renders.at(-1)).toBe(measured);
  });
});
