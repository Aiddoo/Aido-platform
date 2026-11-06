import '@src/shared/i18n/init';
import { createErrorReporterStub, createAnalyticsStub } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import type { TodoRepeat } from '../domains/todo-repeat.model';
import { TodoScheduleLine } from './todo-row';

const MON_THU: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 1,
  weekdays: ['MON', 'THU'],
  end: { type: 'UNTIL', date: '2026-12-31' },
};

const renderLine = (timeLabel: string | null, todo: Parameters<typeof createParentTodo>[0]) =>
  renderUi(<TodoScheduleLine todo={createParentTodo(todo)} timeLabel={timeLabel} />, {
    di: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub() },
  });

describe('TodoScheduleLine', () => {
  test('시간과 주기를 함께 보이고 끝나는 날은 넣지 않으며 스크린리더는 쉼표로 이어 읽는다', async () => {
    // Given & When
    await renderLine('오전 10:00', { recurrenceGroupId: 'series-1', repeat: MON_THU });

    // Then
    expect(screen.getByText('오전 10:00')).toBeTruthy();
    expect(screen.getByText('매주 월·목')).toBeTruthy();
    expect(screen.queryByText(/12월 31일/)).toBeNull();
    expect(screen.getByLabelText('오전 10:00, 매주 월, 목 반복')).toBeTruthy();
  });

  test('시간이 없으면 주기만 보인다', async () => {
    // Given & When
    await renderLine(null, { recurrenceGroupId: 'series-1', repeat: MON_THU });

    // Then
    expect(screen.getByLabelText('매주 월, 목 반복')).toBeTruthy();
  });

  test('규칙을 모르는 반복 회차는 반복이라고만 보인다', async () => {
    // Given & When
    await renderLine('오전 10:00', { recurrenceGroupId: 'series-1', repeat: null });

    // Then
    expect(screen.getByText('반복')).toBeTruthy();
  });

  test('단일 할 일은 시간만 보인다', async () => {
    // Given & When
    await renderLine('오전 10:00', { recurrenceGroupId: null, repeat: null });

    // Then
    expect(screen.getByLabelText('오전 10:00')).toBeTruthy();
    expect(screen.queryByText('반복')).toBeNull();
  });
});
