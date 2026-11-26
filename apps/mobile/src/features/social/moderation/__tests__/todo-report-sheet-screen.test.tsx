import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createTodoDetails } from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  createTestQueryClient,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import TodoReportSheetRoute from '../../../../../app/(app)/todo/[todoId]/report';
import { createUserReportResponseDto } from './moderation.fixtures';

const TODO_ID = 12;
const OWNER = { id: 'clz7x5p8k0010qz0z8z8z8z8z', name: '친구', profileImage: null };

async function renderTodoReportSheet() {
  createRouteParamsFake({ todoId: String(TODO_ID) });
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  // 상세 화면이 이미 받은 할 일 상세가 캐시에 있다
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_QUERY_KEYS.detail({ todoId: TODO_ID }), createTodoDetails());
  await renderScreen(<TodoReportSheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, queryClient } }),
    withLocalDate: true,
  });
  await layoutSheetRoute();
  await screen.findByTestId('report-reason-sheet');

  return { httpClient, analytics };
}

describe('TodoReportSheetRoute', () => {
  it('할 일을 신고하면 할 일 주인과 그 할 일의 id를 대상으로 한 번 보내고 시트를 닫는다', async () => {
    // Given
    const { httpClient, analytics } = await renderTodoReportSheet();
    httpClient.post.mockResolvedValue(ok(createUserReportResponseDto()));
    await fireEvent.press(screen.getByTestId('report-reason-INAPPROPRIATE'));
    await fireEvent.changeText(screen.getByTestId('report-detail-input'), '   ');

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/reports', {
      targetUserId: OWNER.id,
      targetType: 'TODO',
      targetId: String(TODO_ID),
      reason: 'INAPPROPRIATE',
    });
    expect(getTrackedEvents(analytics, 'content_reported')).toEqual([
      { target_type: 'TODO', reason: 'INAPPROPRIATE' },
    ]);
  });

  it('캐시에 있는 할 일 상세로 열어 서버에 다시 묻지 않는다', async () => {
    // When
    const { httpClient } = await renderTodoReportSheet();

    // Then
    expect(countGetRequests(httpClient)).toEqual({});
  });
});
