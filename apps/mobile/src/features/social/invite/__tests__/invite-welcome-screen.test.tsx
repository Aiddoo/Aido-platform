import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import InviteWelcomeSheetRoute from '../../../../../app/(app)/invite-welcome/[friendId]';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import { INVITE_QUERY_KEYS } from '../queries/invite-query-keys';
import { createRedemptionResult } from './invite.fixtures';

const INVITER_ID = createRedemptionResult().inviter.userId;

async function renderWelcome({
  friendId = INVITER_ID,
  redemption = createRedemptionResult(),
}: {
  friendId?: string;
  redemption?: RedemptionResult | null;
} = {}) {
  createRouteParamsFake({ friendId });
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(respondByPath({ 'v1/auth/me': ok(createCurrentUserDto()) }));
  const di = createTestDi({ ports: { httpClient } });
  if (redemption != null) {
    di.queryClient.setQueryData(
      INVITE_QUERY_KEYS.redemption({ inviterId: redemption.inviter.userId }),
      redemption,
    );
  }
  await renderScreen(<InviteWelcomeSheetRoute />, { di, withLocalDate: true });
  await layoutSheetRoute();
}

describe('InviteWelcomeSheetRoute', () => {
  it('보상을 받고 친구가 됐으면 받은 일수를 보이고 첫 할 일 만들기로 피드를 연다', async () => {
    // Given
    await renderWelcome();
    expect(await screen.findByText('민지님과 친구가 됐어요')).toBeOnTheScreen();
    expect(screen.getByText('프리미엄 7일을 받았어요')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '첫 할 일 만들기' }));

    // Then
    await waitFor(() =>
      expect(router.dismissTo).toHaveBeenCalledWith(
        { pathname: '/feed', params: { action: 'add-todo' } },
        undefined,
      ),
    );
  });

  it('친구 할 일 먼저 보기는 초대한 친구의 피드를 연다', async () => {
    // Given
    await renderWelcome();

    // When
    await fireEvent.press(await screen.findByTestId('invite-welcome-open-friend-feed'));

    // Then
    await waitFor(() =>
      expect(router.dismissTo).toHaveBeenCalledWith(
        { pathname: '/feed', params: { friendId: INVITER_ID } },
        undefined,
      ),
    );
  });

  it('친구 자리가 없어 요청만 보냈으면 요청했다고 알리고 나중에 하기로 닫는다', async () => {
    // Given
    await renderWelcome({ redemption: createRedemptionResult({ friendship: 'REQUESTED' }) });
    expect(await screen.findByText('민지님에게 친구 요청을 보냈어요')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByTestId('invite-welcome-later'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('이미 쓰던 계정이라 보상 없이 친구만 맺었으면 보상 줄 없이 그 이유를 알린다', async () => {
    // When
    await renderWelcome({
      redemption: {
        outcome: 'CONNECTED',
        inviter: createRedemptionResult().inviter,
        friendship: 'FRIENDS',
      },
    });

    // Then
    expect(
      await screen.findByText('이미 아이두를 쓰고 있어서 이번에는 친구만 맺었어요'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/프리미엄 \d+일을 받았어요/u)).toBeNull();
  });

  it.each([
    { reason: '수락 결과가 없으면', friendId: INVITER_ID, redemption: null },
    {
      reason: '친구 id 형식이 틀리면',
      friendId: 'not-a-user',
      redemption: createRedemptionResult(),
    },
  ])('$reason 그리지 않고 바로 닫는다', async ({ friendId, redemption }) => {
    // When
    await renderWelcome({ friendId, redemption });

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('invite-welcome-sheet')).toBeNull();
  });
});
