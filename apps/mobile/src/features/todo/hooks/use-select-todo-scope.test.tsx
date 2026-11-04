import '@src/shared/i18n/init';
import { createErrorReporterStub, createMockAnalytics } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import type { TodoEditScope } from '../domains/todo-repeat.model';
import {
  TodoScopeStep,
  useSelectTodoEditScopeInOverlay,
  useSelectTodoScope,
} from './use-select-todo-scope';

function SheetProbe({ onSettled }: { onSettled: (scope: TodoEditScope | null) => void }) {
  const scopeSelector = useSelectTodoScope();
  const [title, setTitle] = useState('');

  return (
    <TodoScopeStep step={scopeSelector}>
      <TextInput testID="title" value={title} onChangeText={setTitle} />
      <Pressable
        testID="save"
        onPress={async () => onSettled(await scopeSelector.selectEditScope('2026-11-04'))}
      />
      <Text>폼</Text>
    </TodoScopeStep>
  );
}

async function renderSheet() {
  const onSettled = jest.fn();
  await renderUi(
    <LocalDateProvider>
      <SheetProbe onSettled={onSettled} />
    </LocalDateProvider>,
    { di: { analytics: createMockAnalytics(), errorReporter: createErrorReporterStub() } },
  );
  await fireEvent.changeText(screen.getByTestId('title'), '장보기');
  // 범위를 고를 때까지 끝나지 않는 핸들러라 기다리지 않는다
  fireEvent.press(screen.getByTestId('save')).catch(() => undefined);
  await screen.findByTestId('todo-scope-select');
  return { onSettled };
}

describe('useSelectTodoScope', () => {
  test('범위를 묻는 동안 같은 자리에 범위 선택을 보이고 앞 화면의 입력값은 남긴다', async () => {
    // Given
    await renderSheet();

    // Then
    expect(screen.getByTestId('todo-scope-select')).toBeTruthy();
    expect(screen.getByTestId('title', { includeHiddenElements: true }).props.value).toBe('장보기');
  });

  test('뒤로 가면 null로 끝나고 입력하던 화면이 그대로 돌아온다', async () => {
    // Given
    const { onSettled } = await renderSheet();

    // When
    await fireEvent.press(screen.getByLabelText('뒤로 가기'));

    // Then
    expect(onSettled).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('title').props.value).toBe('장보기');
    expect(screen.queryByTestId('todo-scope-select')).toBeNull();
  });

  test('범위를 고르면 그 범위로 한 번만 끝난다', async () => {
    // Given
    const { onSettled } = await renderSheet();

    // When
    await fireEvent.press(screen.getByLabelText('이 할 일과 이후 할 일'));

    // Then
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });
});

function KeyboardSheetProbe({
  onSettled,
  onBack,
  isFollowingOnly,
}: {
  onSettled: (scope: TodoEditScope | null) => void;
  onBack: () => void;
  isFollowingOnly?: boolean;
}) {
  const selectEditScope = useSelectTodoEditScopeInOverlay({ onBack });
  const [title, setTitle] = useState('');

  return (
    <>
      <TextInput testID="title" value={title} onChangeText={setTitle} />
      <Pressable
        testID="save"
        onPress={async () => onSettled(await selectEditScope('2026-11-04', { isFollowingOnly }))}
      />
    </>
  );
}

async function renderKeyboardSheet({ isFollowingOnly }: { isFollowingOnly?: boolean } = {}) {
  const onSettled = jest.fn();
  const onBack = jest.fn();
  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <KeyboardSheetProbe
          onSettled={onSettled}
          onBack={onBack}
          isFollowingOnly={isFollowingOnly}
        />
      </OverlayProvider>
    </LocalDateProvider>,
    { di: { analytics: createMockAnalytics(), errorReporter: createErrorReporterStub() } },
  );
  await fireEvent.changeText(screen.getByTestId('title'), '장보기');
  // 범위를 고를 때까지 끝나지 않는 핸들러라 기다리지 않는다
  fireEvent.press(screen.getByTestId('save')).catch(() => undefined);
  await screen.findByTestId('todo-scope-select');
  return { onSettled, onBack };
}

describe('useSelectTodoEditScopeInOverlay', () => {
  test('범위를 떠 있는 시트로 묻고 아래 입력 폼은 그대로 둔다', async () => {
    // Given
    await renderKeyboardSheet();

    // Then
    const sheet = screen.getByTestId('modal-bottom-sheet');
    expect(within(sheet).getByTestId('todo-scope-select')).toBeTruthy();
    expect(screen.getByTestId('title', { includeHiddenElements: true }).props.value).toBe('장보기');
  });

  test('뒤로 가면 null로 끝나고 닫힌 뒤 입력으로 돌아가게 알린다', async () => {
    // Given
    const { onSettled, onBack } = await renderKeyboardSheet();

    // When
    await fireEvent.press(screen.getByLabelText('뒤로 가기'));

    // Then
    expect(onSettled).toHaveBeenCalledWith(null);
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('title', { includeHiddenElements: true }).props.value).toBe('장보기');
  });

  test('범위를 고르면 그 범위로 끝나고 입력으로 돌아가지 않는다', async () => {
    // Given
    const { onSettled, onBack } = await renderKeyboardSheet();

    // When
    await fireEvent.press(screen.getByLabelText('이 할 일과 이후 할 일'));

    // Then
    expect(onSettled).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
    await waitFor(() => expect(screen.queryByTestId('modal-bottom-sheet')).toBeNull());
    expect(onBack).not.toHaveBeenCalled();
  });

  test('규칙을 바꾸면 이 할 일만은 보이지 않는다', async () => {
    // Given
    await renderKeyboardSheet({ isFollowingOnly: true });

    // Then
    expect(screen.queryByLabelText('이 할 일만')).toBeNull();
    expect(screen.getByLabelText('이 할 일과 이후 할 일')).toBeTruthy();
  });
});
