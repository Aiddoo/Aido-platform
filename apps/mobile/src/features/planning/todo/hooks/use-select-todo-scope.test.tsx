import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import '@src/shared/i18n/init';
import { Text } from '@src/shared/ui';
import { createErrorReporterStub, createAnalyticsStub, createTestDi } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import { TodoScopeStep } from '../components/todo-scope-step';
import type { TodoEditScope } from '../domains/todo-repeat.model';
import { useSelectTodoScope } from './use-select-todo-scope';

function SheetProbe({ onSettled }: { onSettled: (scope: TodoEditScope | null) => void }) {
  const scopeSelector = useSelectTodoScope();
  const [title, setTitle] = useState('');

  return (
    <TodoScopeStep step={scopeSelector}>
      <TextInput testID="title" value={title} onChangeText={setTitle} />
      <Pressable
        testID="save"
        onPress={async () =>
          onSettled(await scopeSelector.selectEditScope(createDateKey('2026-11-04')))
        }
      />
      <Text>폼</Text>
    </TodoScopeStep>
  );
}

async function renderSheet() {
  const onSettled = jest.fn();
  const { unmount } = await renderScreen(
    <LocalDateProvider>
      <SheetProbe onSettled={onSettled} />
    </LocalDateProvider>,
    {
      di: createTestDi({
        ports: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub() },
      }),
    },
  );
  await fireEvent.changeText(screen.getByTestId('title'), '장보기');
  // 범위를 고를 때까지 끝나지 않는 핸들러라 기다리지 않는다
  fireEvent.press(screen.getByTestId('save')).catch(() => undefined);
  await screen.findByTestId('todo-scope-select');
  return { onSettled, unmount };
}

describe('useSelectTodoScope', () => {
  it('범위를 묻는 동안 같은 자리에 범위 선택을 보이고 앞 화면의 입력값은 남긴다', async () => {
    // When
    await renderSheet();

    // Then
    expect(screen.getByTestId('todo-scope-select')).toBeTruthy();
    expect(screen.getByTestId('title', { includeHiddenElements: true }).props.value).toBe('장보기');
  });

  it('뒤로 가면 null로 끝나고 입력하던 화면이 그대로 돌아온다', async () => {
    // Given
    const { onSettled } = await renderSheet();

    // When
    await fireEvent.press(screen.getByLabelText('뒤로 가기'));

    // Then
    expect(onSettled).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('title').props.value).toBe('장보기');
    expect(screen.queryByTestId('todo-scope-select')).toBeNull();
  });

  it('범위를 묻는 중에 시트가 닫히면 취소(null)로 끝나 저장 핸들러가 남지 않는다', async () => {
    // Given
    const { onSettled, unmount } = await renderSheet();

    // When
    await unmount();

    // Then
    expect(onSettled).toHaveBeenCalledWith(null);
  });

  it('범위를 고르면 그 범위로 한 번만 끝난다', async () => {
    // Given
    const { onSettled } = await renderSheet();

    // When
    await fireEvent.press(screen.getByLabelText('이 할 일과 이후 할 일'));

    // Then
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });
});
