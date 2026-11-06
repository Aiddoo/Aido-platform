import { TODO_EDIT_SCOPES, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { createErrorReporterStub, createMockAnalytics } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { TodoScopeSelectContent } from './todo-scope-select-content';

const renderScope = (ui: ReactElement) =>
  renderUi(<LocalDateProvider>{ui}</LocalDateProvider>, {
    di: { analytics: createMockAnalytics(), errorReporter: createErrorReporterStub() },
  });

describe('TodoScopeSelectContent', () => {
  test('수정은 이 할 일만과 이후 할 일 두 가지를 날짜 설명과 함께 보여준다', async () => {
    // Given
    const onChange = jest.fn();
    await renderScope(
      <TodoScopeSelectContent
        action="edit"
        date="2026-11-04"
        scopes={TODO_UPDATE_SCOPES}
        onChange={onChange}
      />,
    );

    // When
    await fireEvent.press(screen.getByLabelText('이 할 일과 이후 할 일'));

    // Then
    expect(screen.getByText('11월 4일 할 일만 바뀌어요')).toBeTruthy();
    expect(screen.getByText('11월 4일부터 쭉 바뀌어요')).toBeTruthy();
    expect(screen.queryByLabelText('이 반복 전체')).toBeNull();
    expect(onChange).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });

  test('규칙을 바꾸면 이 할 일만은 고를 수 없어 이후 범위 한 줄만 보여준다', async () => {
    // Given
    const onChange = jest.fn();
    await renderScope(
      <TodoScopeSelectContent
        action="edit"
        date="2026-11-04"
        scopes={['THIS_AND_FOLLOWING']}
        onChange={onChange}
      />,
    );

    // When
    await fireEvent.press(screen.getByLabelText('이 할 일과 이후 할 일'));

    // Then
    expect(screen.queryByLabelText('이 할 일만')).toBeNull();
    expect(onChange).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });

  test('삭제는 전체 삭제와 완료 기록 안내까지 한 행으로 보여준다', async () => {
    // Given
    const onChange = jest.fn();
    await renderScope(
      <TodoScopeSelectContent
        action="delete"
        date="2026-11-04"
        scopes={TODO_EDIT_SCOPES}
        onChange={onChange}
      />,
    );

    // When
    await fireEvent.press(screen.getByLabelText('이 반복 전체'));

    // Then
    expect(screen.getByText('11월 4일 할 일만 삭제돼요')).toBeTruthy();
    expect(screen.getByText('지난 할 일과 완료한 기록까지 모두 삭제돼요')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('ALL');
  });

  test('규칙 없는 묶음의 삭제는 이후 범위 없이 이 할 일만과 이 반복 전체를 보여준다', async () => {
    // Given
    const onChange = jest.fn();
    await renderScope(
      <TodoScopeSelectContent
        action="delete"
        date="2026-11-04"
        scopes={['THIS_ONLY', 'ALL']}
        onChange={onChange}
      />,
    );

    // When
    await fireEvent.press(screen.getByLabelText('이 반복 전체'));

    // Then
    expect(screen.queryByLabelText('이 할 일과 이후 할 일')).toBeNull();
    expect(screen.getByLabelText('이 할 일만')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('ALL');
  });
});
