import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it('isDisabled와 isLoading 모두 버튼을 비활성화한다', async () => {
    // When
    const { rerender } = await renderUi(
      <Button testID="button" isDisabled>
        버튼
      </Button>,
    );

    // Then
    expect(screen.getByTestId('button').props.accessibilityState.disabled).toBe(true);

    // When
    await rerender(
      <Button testID="button" isLoading>
        버튼
      </Button>,
    );

    // Then
    expect(screen.getByTestId('button').props.accessibilityState.disabled).toBe(true);
  });
});

describe('buttonVariants', () => {});
