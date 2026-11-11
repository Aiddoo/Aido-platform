import '@src/shared/i18n/init';
import { createErrorReporterStub, createAnalyticsStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TodoScheduleLine } from './todo-row';

const renderLine = (timeLabel: string | null, todo: Parameters<typeof createParentTodo>[0]) =>
  renderScreen(<TodoScheduleLine todo={createParentTodo(todo)} timeLabel={timeLabel} />, {
    di: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub() },
  });

describe('TodoScheduleLine', () => {
  it('규칙을 모르는 반복 회차는 반복이라고만 보인다', async () => {
    // When
    await renderLine('오전 10:00', { recurrenceGroupId: 'series-1', repeat: null });

    // Then
    expect(screen.getByText('반복')).toBeTruthy();
  });
});
