import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, type KeyboardEvent, TextInput } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

import { useScrollFocusedInputIntoView } from './use-scroll-focused-input-into-view';

const KEYBOARD_WILL_SHOW: KeyboardEvent = {
  duration: 250,
  easing: 'keyboard',
  startCoordinates: { screenX: 0, screenY: 800, width: 400, height: 300 },
  endCoordinates: { screenX: 0, screenY: 500, width: 400, height: 300 },
  isEventFromThisApp: true,
};

// 포커스 대기는 최대 30프레임이다. 그보다 넉넉히 흘린다
const WAIT_LONGER_THAN_FOCUS_POLLING_MS = 2_000;

function showKeyboard(addKeyboardListener: jest.SpiedFunction<typeof Keyboard.addListener>) {
  return act(async () => {
    addKeyboardListener.mock.calls
      .filter(([eventName]) => eventName === 'keyboardWillShow')
      .forEach(([_eventName, listener]) => listener(KEYBOARD_WILL_SHOW));
  });
}

describe('useScrollFocusedInputIntoView', () => {
  setupFakeTimersPerTest();

  it('키보드가 올라오는 중에 시트가 닫히면 포커스 입력을 더 기다리지 않는다', async () => {
    // Given
    const addKeyboardListener = jest.spyOn(Keyboard, 'addListener');
    const findFocusedInput = jest
      .spyOn(TextInput.State, 'currentlyFocusedInput')
      .mockReturnValue(undefined);
    const animatedPosition = makeMutable(0);
    const { rerender } = await renderHook(
      (isOpen: boolean) =>
        useScrollFocusedInputIntoView({
          isOpen,
          animatedPosition,
          bottomInset: 0,
          viewportTopLimit: 0,
        }),
      { initialProps: true },
    );
    await showKeyboard(addKeyboardListener);
    const checksBeforeClose = findFocusedInput.mock.calls.length;

    // When
    await rerender(false);
    await act(async () => jest.advanceTimersByTime(WAIT_LONGER_THAN_FOCUS_POLLING_MS));

    // Then
    expect(checksBeforeClose).toBeGreaterThan(0);
    expect(findFocusedInput).toHaveBeenCalledTimes(checksBeforeClose);
  });

  it('키보드가 올라온 뒤 고정 footer 높이가 바뀌면 떠 있는 키보드 기준으로 포커스 입력을 다시 찾는다', async () => {
    // Given
    const addKeyboardListener = jest.spyOn(Keyboard, 'addListener');
    const findFocusedInput = jest
      .spyOn(TextInput.State, 'currentlyFocusedInput')
      .mockReturnValue(undefined);
    const animatedPosition = makeMutable(0);
    const { rerender } = await renderHook(
      (bottomInset: number) =>
        useScrollFocusedInputIntoView({
          isOpen: true,
          animatedPosition,
          bottomInset,
          viewportTopLimit: 0,
        }),
      { initialProps: 0 },
    );
    await showKeyboard(addKeyboardListener);
    await act(async () => jest.advanceTimersByTime(WAIT_LONGER_THAN_FOCUS_POLLING_MS));
    const checksBeforeFooter = findFocusedInput.mock.calls.length;

    // When
    await rerender(56);
    await act(async () => jest.advanceTimersByTime(WAIT_LONGER_THAN_FOCUS_POLLING_MS));

    // Then
    expect(findFocusedInput.mock.calls.length).toBeGreaterThan(checksBeforeFooter);
  });
});
