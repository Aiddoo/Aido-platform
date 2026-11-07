import { renderUi } from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it.each([
    { name: 'isDisabled', props: { isDisabled: true } },
    { name: 'isLoading', props: { isLoading: true } },
  ])('$name이면 버튼을 비활성화한다', async ({ props }) => {
    // When
    await renderUi(
      <Button testID="button" {...props}>
        버튼
      </Button>,
    );

    // Then
    expect(screen.getByTestId('button').props.accessibilityState.disabled).toBe(true);
  });
});
