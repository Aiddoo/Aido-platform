import { fireEvent, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactElement } from 'react';

import { Button } from './button';

function renderInProvider(ui: ReactElement) {
  return render(<HeroUINativeProvider>{ui}</HeroUINativeProvider>);
}

describe('Button 누름', () => {
  beforeEach(() => {
    // HeroUI 개발 안내와 Uniwind 변수 경고는 테스트 판정과 무관하다
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('isLoading 중에는 두 번 눌러도 onPress를 부르지 않는다', async () => {
    // Given
    const onPress = jest.fn();
    await renderInProvider(
      <Button isLoading onPress={onPress} testID="button">
        저장
      </Button>,
    );

    // When
    await fireEvent.press(screen.getByTestId('button'));
    await fireEvent.press(screen.getByTestId('button'));

    // Then
    expect(onPress).not.toHaveBeenCalled();
  });
});
