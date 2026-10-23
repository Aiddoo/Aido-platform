import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { render, screen } from '@testing-library/react-native';

import { TodoCommentKeyboardScrollView } from './todo-comment-keyboard-scroll-view';

jest.mock('@src/shared/providers/keyboard-bottom-gap-provider');

const mockedUseKeyboardBottomGap = jest.mocked(useKeyboardBottomGap);

describe('TodoCommentKeyboardScrollView', () => {
  it('화면 아래까지 닿지 않는 pane이면 그 거리만큼 키보드 이동량을 줄인다', async () => {
    // Given
    mockedUseKeyboardBottomGap.mockReturnValue(80);

    // When
    await render(<TodoCommentKeyboardScrollView testID="scroll-view" />);

    // Then
    expect(screen.getByTestId('scroll-view').props.offset).toBe(80);
  });

  it('화면 전체를 쓰는 라우트에서는 오프셋이 0이다', async () => {
    // Given
    mockedUseKeyboardBottomGap.mockReturnValue(0);

    // When
    await render(<TodoCommentKeyboardScrollView testID="scroll-view" />);

    // Then
    expect(screen.getByTestId('scroll-view').props.offset).toBe(0);
  });
});
