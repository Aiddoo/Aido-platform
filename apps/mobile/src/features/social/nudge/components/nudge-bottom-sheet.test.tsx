import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail } from '@src/core/errors/result';
import {
  createEntitlementSnapshot,
  createLimitApiError,
} from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { i18n } from '@src/shared/i18n';
import {
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { NudgeBottomSheet } from './nudge-bottom-sheet';

describe('NudgeBottomSheet', () => {
  it('콕 한도에 막히면 한도 시트와 햅틱 한 번만 보이고 전역 토스트를 더하지 않으며 시트를 닫지 않는다', async () => {
    // Given
    const limitError = createLimitApiError(ErrorCode.NUDGE_1101);
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(fail(limitError));
    const haptics = createHapticsGatewayStub();
    const errorReporter = createErrorReporterStub();
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
    const onOpenChange = jest.fn();
    await renderScreen(
      <NudgeBottomSheet
        receiver={{ id: 'friend-1', displayName: '민지' }}
        todo={{ id: 1, title: '운동' }}
        isOpen
        onOpenChange={onOpenChange}
      />,
      {
        di: createTestDi({ ports: { httpClient, haptics, errorReporter, queryClient } }),
        withOverlay: true,
        withLocalDate: true,
      },
    );

    // When
    await fireEvent.press(await screen.findByText('응원 보내기'));

    // Then
    expect(await screen.findByText(i18n.t('subscription:gate.nudgeTitle'))).toBeTruthy();
    expect(screen.queryByText(limitError.message)).toBeNull();
    expect(screen.queryByText(i18n.t('todo:toast.retryLater'))).toBeNull();
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(errorReporter.captureException).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
