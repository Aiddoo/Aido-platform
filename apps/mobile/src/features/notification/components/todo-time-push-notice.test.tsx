import '@src/shared/i18n/init';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createLoggerStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { PushPermission } from '../domains/push-permission.model';
import { PUSH_PERMISSION_QUERY_KEYS } from '../queries/push-permission-query-keys';
import { TodoTimePushNotice } from './todo-time-push-notice';

const OFF_LINE = '알림이 꺼져 있어 알려드릴 수 없어요';

async function renderNotice(permission: PushPermission, { isTimed }: { isTimed: boolean }) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(PUSH_PERMISSION_QUERY_KEYS.current(), permission);
  const externalLink = createExternalLinkGatewayStub();
  await renderScreen(<TodoTimePushNotice isTimed={isTimed} />, {
    queryClient,
    di: { externalLink, analytics: createAnalyticsStub(), logger: createLoggerStub() },
  });
  return { externalLink };
}

describe('TodoTimePushNotice — 시간 칩 아래 한 줄', () => {
  it('알림을 거절한 채 시각을 정하면 저장은 그대로 두고 설정을 열 수 있게 한다', async () => {
    // Given
    const { externalLink } = await renderNotice(
      { status: 'DENIED', canAskAgain: false },
      { isTimed: true },
    );
    expect(screen.getByText(OFF_LINE)).toBeTruthy();

    // When
    fireEvent.press(screen.getByText('설정 열기'));

    // Then
    await waitFor(() => expect(externalLink.openSettings).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['종일 할 일이면', { status: 'DENIED', canAskAgain: false }, false],
    ['아직 묻지 않았으면 시스템 창이 맡아', { status: 'NOT_DETERMINED', canAskAgain: true }, true],
    ['허용했으면', { status: 'GRANTED', canAskAgain: false }, true],
  ] as const)('%s 보이지 않는다', async (_label, permission, isTimed) => {
    // When
    await renderNotice(permission, { isTimed });

    // Then
    expect(screen.queryByText(OFF_LINE)).toBeNull();
  });
});
