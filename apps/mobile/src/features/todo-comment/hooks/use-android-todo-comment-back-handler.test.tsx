import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { useAndroidTodoCommentBackHandler } from './use-android-todo-comment-back-handler';
import { useTodoCommentBack } from './use-todo-comment-back';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});
jest.mock('./use-todo-comment-back');

const mockedUseTodoCommentBack = jest.mocked(useTodoCommentBack);

function givenCommentBack(handleBack: () => boolean) {
  mockedUseTodoCommentBack.mockReturnValue({ result: { status: 'native' }, handleBack });
}

async function pressHardwareBack(options?: { onExit?: () => void }) {
  let hardwareBackListener: () => boolean | null | undefined = () => undefined;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_eventName, listener) => {
    hardwareBackListener = listener;
    return { remove: jest.fn() };
  });

  await renderHook(() => useAndroidTodoCommentBackHandler(options));

  return hardwareBackListener();
}

describe('useAndroidTodoCommentBackHandler', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('댓글 화면이 되돌릴 단계가 있으면 처리하고 onExit을 부르지 않는다', async () => {
    // Given
    givenCommentBack(() => true);
    const onExit = jest.fn();

    // When
    const isHandled = await pressHardwareBack({ onExit });

    // Then
    expect(isHandled).toBe(true);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('되돌릴 단계가 없고 onExit이 있으면 onExit을 부르고 기본 동작을 막는다', async () => {
    // Given
    givenCommentBack(() => false);
    const onExit = jest.fn();

    // When
    const isHandled = await pressHardwareBack({ onExit });

    // Then
    expect(isHandled).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('되돌릴 단계가 없고 onExit도 없으면 기본 뒤로가기에 맡긴다', async () => {
    // Given
    givenCommentBack(() => false);

    // When
    const isHandled = await pressHardwareBack();

    // Then
    expect(isHandled).toBe(false);
  });
});
