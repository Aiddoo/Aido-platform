import '@src/shared/i18n/init';
import { createErrorReporterStub, createAnalyticsStub } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TodoScheduleLine } from './todo-row';

const renderLine = (timeLabel: string | null, todo: Parameters<typeof createParentTodo>[0]) =>
  renderUi(<TodoScheduleLine todo={createParentTodo(todo)} timeLabel={timeLabel} />, {
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
