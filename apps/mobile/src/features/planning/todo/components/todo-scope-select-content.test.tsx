import { TODO_EDIT_SCOPES, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { createErrorReporterStub, createAnalyticsStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { TodoScopeSelectContent } from './todo-scope-select-content';

const renderScope = (ui: ReactElement) =>
  renderScreen(<LocalDateProvider>{ui}</LocalDateProvider>, {
    di: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub() },
  });

describe('TodoScopeSelectContent', () => {
  it('수정은 이 할 일만과 이후 할 일 두 가지를 날짜 설명과 함께 보여준다', async () => {
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

  it('삭제는 전체 삭제와 완료 기록 안내까지 한 행으로 보여준다', async () => {
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
});
