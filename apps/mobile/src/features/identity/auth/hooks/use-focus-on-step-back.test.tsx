import { renderHook } from '@testing-library/react-native';

import { useFocusOnStepBack } from './use-focus-on-step-back';

describe('useFocusOnStepBack', () => {
  it('다음 단계에서 첫 단계로 돌아올 때만 포커스를 옮긴다', async () => {
    // Given
    const focus = jest.fn();
    const { rerender } = await renderHook(
      ({ step }: { step: 'name' | 'email' }) =>
        useFocusOnStepBack({ step, firstStep: 'name', focus }),
      { initialProps: { step: 'name' } },
    );

    // When
    await rerender({ step: 'email' });

    // Then
    expect(focus).not.toHaveBeenCalled();

    // When
    await rerender({ step: 'name' });

    // Then
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
