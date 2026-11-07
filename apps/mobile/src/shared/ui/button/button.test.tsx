import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  test('isDisabled와 isLoading 모두 버튼을 비활성화한다', async () => {
    const { rerender } = await renderUi(
      <Button testID="button" isDisabled>
        버튼
      </Button>,
    );
    expect(screen.getByTestId('button').props.accessibilityState.disabled).toBe(true);

    await rerender(
      <Button testID="button" isLoading>
        버튼
      </Button>,
    );
    expect(screen.getByTestId('button').props.accessibilityState.disabled).toBe(true);
  });
});

describe('buttonVariants', () => {});
