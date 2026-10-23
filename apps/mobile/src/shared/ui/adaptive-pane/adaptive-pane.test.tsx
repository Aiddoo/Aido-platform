import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';

import { AdaptivePane } from './adaptive-pane';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseWindowDimensions = jest.mocked(useWindowDimensions);

function renderPane(width: number) {
  mockedUseWindowDimensions.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
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
});
