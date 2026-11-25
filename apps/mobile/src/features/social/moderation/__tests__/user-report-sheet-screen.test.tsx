import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createRouteParamsFake,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import UserReportSheetRoute from '../../../../../app/(app)/users/[userId]/report';
import { BLOCKED_USER_ID, createUserReportResponseDto } from './moderation.fixtures';

const USER_NAME = '홍길동';
const PROFILE_PARAMS = { userId: BLOCKED_USER_ID, name: USER_NAME, targetType: 'PROFILE' };
const NUDGE_PARAMS = {
  userId: BLOCKED_USER_ID,
  name: USER_NAME,
  targetType: 'NUDGE_MESSAGE',
  targetId: '7',
};

async function renderUserReportSheet(params: Record<string, string>) {
  createRouteParamsFake(params);
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  await renderScreen(<UserReportSheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics } }),
    withLocalDate: true,
  });
  await layoutSheetRoute();
  await screen.findByTestId('report-reason-sheet');

  return { httpClient, analytics, haptics };
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName);
}

function getPostedBody(httpClient: ReturnType<typeof createHttpClientStub>) {
  const [call] = httpClient.post.mock.calls;
  return call?.[1];
}

describe('UserReportSheetRoute', () => {
  it('프로필을 신고하면 대상 콘텐츠 칸 없이 한 번 보내고 시트를 닫으며 알린다', async () => {
    // Given
    const { httpClient, analytics } = await renderUserReportSheet(PROFILE_PARAMS);
    httpClient.post.mockResolvedValue(ok(createUserReportResponseDto()));
    await fireEvent.press(screen.getByTestId('report-reason-HARASSMENT'));
    await fireEvent.changeText(screen.getByTestId('report-detail-input'), ' 계속 욕을 해요 ');

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/reports', {
      targetUserId: BLOCKED_USER_ID,
      targetType: 'PROFILE',
      reason: 'HARASSMENT',
      detail: '계속 욕을 해요',
    });
    expect(getPostedBody(httpClient)).not.toHaveProperty('targetId');
    expect(await screen.findByText('신고했어요')).toBeOnTheScreen();
    expect(countEvents(analytics, 'content_reported')).toEqual([
      ['content_reported', { target_type: 'PROFILE', reason: 'HARASSMENT' }],
    ]);
  });

  it('콕 메시지를 신고하면 그 콕의 id를 대상으로 보낸다', async () => {
    // Given
    const { httpClient, analytics } = await renderUserReportSheet(NUDGE_PARAMS);
    httpClient.post.mockResolvedValue(ok(createUserReportResponseDto()));
    await fireEvent.press(screen.getByTestId('report-reason-SPAM'));

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledWith('v1/reports', {
      targetUserId: BLOCKED_USER_ID,
      targetType: 'NUDGE_MESSAGE',
      targetId: '7',
      reason: 'SPAM',
    });
    expect(countEvents(analytics, 'content_reported')).toEqual([
      ['content_reported', { target_type: 'NUDGE_MESSAGE', reason: 'SPAM' }],
    ]);
  });

  it('처음 열 때 서버에서 아무것도 받지 않는다', async () => {
    // When
    const { httpClient } = await renderUserReportSheet(PROFILE_PARAMS);

    // Then
    expect(countGetRequests(httpClient)).toEqual({});
  });

  it('사유를 고르지 않으면 신고 버튼이 꺼져 눌러도 보내지 않는다', async () => {
    // Given
    const { httpClient } = await renderUserReportSheet(PROFILE_PARAMS);
    await fireEvent.changeText(screen.getByTestId('report-detail-input'), '상세만 적었어요');

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    expect(screen.getByTestId('report-submit')).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('상세가 한도를 넘으면 칸에 알리고 보내지 않는다', async () => {
    // Given
    const { httpClient } = await renderUserReportSheet(PROFILE_PARAMS);
    await fireEvent.press(screen.getByTestId('report-reason-OTHER'));
    await fireEvent.changeText(screen.getByTestId('report-detail-input'), '가'.repeat(501));

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    expect(await screen.findByText(/500자/u)).toBeOnTheScreen();
    expect(httpClient.post).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('연결이 끊겨 보내지 못하면 한 번 알리고 고른 사유와 상세를 둔 채 시트에 머문다', async () => {
    // Given
    const { httpClient, analytics, haptics } = await renderUserReportSheet(PROFILE_PARAMS);
    httpClient.post.mockRejectedValue(new NetworkError());
    await fireEvent.press(screen.getByTestId('report-reason-SPAM'));
    await fireEvent.changeText(screen.getByTestId('report-detail-input'), '광고 계정이에요');

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByTestId('report-detail-input')).toHaveDisplayValue('광고 계정이에요');
    expect(screen.getByTestId('report-submit')).toBeEnabled();
    expect(router.back).not.toHaveBeenCalled();
    expect(countEvents(analytics, 'content_reported')).toHaveLength(0);
  });

  it('신고할 대상이 사라졌으면 알리고 시트를 닫는다', async () => {
    // Given
    const { httpClient, haptics } = await renderUserReportSheet(NUDGE_PARAMS);
    httpClient.post.mockResolvedValue(fail(createApiError(ErrorCode.REPORT_2251)));
    await fireEvent.press(screen.getByTestId('report-reason-SPAM'));

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
  });

  it('같은 프레임에 신고를 두 번 누르면 요청이 한 번 나간다', async () => {
    // Given
    const { httpClient } = await renderUserReportSheet(PROFILE_PARAMS);
    const pending = createPendingResponse(ok(createUserReportResponseDto()));
    httpClient.post.mockReturnValue(pending.response);
    await fireEvent.press(screen.getByTestId('report-reason-SPAM'));
    const submit = screen.getByTestId('report-submit');

    // When
    await act(async () => {
      // 누름은 응답이 와야 끝나 기다리지 않고, 다시 그리기 전에 두 번 닿게 한 act 안에서 누른다
      fireEvent.press(submit).catch(() => undefined);
      fireEvent.press(submit).catch(() => undefined);
    });
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('신고 뒤 알림의 차단하기를 누르면 그 사람의 차단 확인을 연다', async () => {
    // Given
    const { httpClient } = await renderUserReportSheet(PROFILE_PARAMS);
    httpClient.post.mockResolvedValue(ok(createUserReportResponseDto()));
    await fireEvent.press(screen.getByTestId('report-reason-SPAM'));
    await fireEvent.press(screen.getByTestId('report-submit'));

    // When
    await fireEvent.press(await screen.findByText('차단하기'));

    // Then
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/users/[userId]/block',
      params: { userId: BLOCKED_USER_ID, name: USER_NAME },
    });
  });
});
