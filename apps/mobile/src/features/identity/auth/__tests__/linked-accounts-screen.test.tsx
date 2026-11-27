import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createSocialAuthGatewayStub,
  createTestDi,
  getTrackedEvents,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import LinkedAccountsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/linked-accounts';
import { createLinkedAccountsDto } from './auth.fixtures';

const LINKED_ACCOUNTS_PATH = 'v1/auth/linked-accounts';
const GOOGLE_LINKED = createLinkedAccountsDto();
const NOTHING_LINKED = createLinkedAccountsDto({
  accounts: [
    { provider: 'GOOGLE', linked: false, providerAccountId: null, linkedAt: null },
    { provider: 'KAKAO', linked: false, providerAccountId: null, linkedAt: null },
  ],
});

type LinkedAccountsDto = ReturnType<typeof createLinkedAccountsDto>;

async function renderLinkedAccounts(initial: LinkedAccountsDto = GOOGLE_LINKED) {
  let linkedAccounts = initial;
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({ [LINKED_ACCOUNTS_PATH]: async () => ok(linkedAccounts) }),
  );
  const socialAuth = createSocialAuthGatewayStub();
  const analytics = createAnalyticsStub();
  await renderScreen(<LinkedAccountsScreen />, {
    di: createTestDi({ ports: { httpClient, socialAuth, analytics } }),
    withOverlay: true,
  });
  await screen.findByText('Google');

  return {
    httpClient,
    socialAuth,
    analytics,
    /** 다음 조회부터 서버가 돌려줄 연결 상태 */
    moveTo(next: LinkedAccountsDto) {
      linkedAccounts = next;
    },
  };
}

/** 확인 다이얼로그를 열어 둔다. 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않아 기다리지 않는다 */
async function openUnlinkDialog() {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: '해제' })).catch(() => undefined);
  });
  await screen.findByText('계정 연결 해제');
}

function getDialogUnlinkButton() {
  const confirm = screen.getAllByRole('button', { name: '해제' }).at(-1);
  if (confirm == null) {
    throw new Error('다이얼로그의 해제 단추가 없습니다');
  }
  return confirm;
}

describe('LinkedAccountsScreen', () => {
  describe('연결 해제', () => {
    it('확인하면 한 번 해제하고 알린 뒤 다시 받은 상태로 연결 안 됨을 보인다', async () => {
      // Given
      const { httpClient, analytics, moveTo } = await renderLinkedAccounts();
      httpClient.delete.mockImplementation(async () => {
        moveTo(NOTHING_LINKED);
        return ok({ message: '소셜 계정 연결이 해제되었습니다.', provider: 'GOOGLE' });
      });
      await openUnlinkDialog();
      expect(screen.getByText(/Google 계정 연결을 해제할까요\?/)).toBeOnTheScreen();

      // When
      await fireEvent.press(getDialogUnlinkButton());

      // Then
      expect(await screen.findByText('Google 계정 연결을 해제했어요')).toBeOnTheScreen();
      expect(httpClient.delete).toHaveBeenCalledTimes(1);
      expect(httpClient.delete).toHaveBeenCalledWith(`${LINKED_ACCOUNTS_PATH}/GOOGLE`);
      expect(getTrackedEvents(analytics, 'auth_social_unlinked')).toEqual([{ provider: 'google' }]);
      await waitFor(() => expect(screen.queryByRole('button', { name: '해제' })).toBeNull());
      // 카카오·Google·Apple·네이버 모두 연결 안 됨이다
      expect(screen.getAllByText('연결 안 됨')).toHaveLength(4);
    });

    it('다이얼로그에서 취소하면 해제하지 않고 연결됨을 그대로 둔다', async () => {
      // Given
      const { httpClient, analytics } = await renderLinkedAccounts();
      await openUnlinkDialog();

      // When
      await fireEvent.press(screen.getByRole('button', { name: '취소' }));

      // Then
      await waitFor(() => expect(screen.queryByText('계정 연결 해제')).toBeNull());
      expect(httpClient.delete).not.toHaveBeenCalled();
      expect(screen.getByText('연결됨')).toBeOnTheScreen();
      expect(getTrackedEvents(analytics, 'auth_social_unlinked')).toEqual([]);
    });

    it('마지막 로그인 수단이라 해제할 수 없으면 해제 단추를 끈다', async () => {
      // When
      await renderLinkedAccounts(createLinkedAccountsDto({ canUnlink: false }));

      // Then
      expect(screen.getByRole('button', { name: '해제' })).toBeDisabled();
    });
  });

  it('연결 안 된 공급자의 연결을 누르면 그 공급자 창으로 받은 코드로 연결하고 알린다', async () => {
    // Given
    const { httpClient, socialAuth, analytics } = await renderLinkedAccounts();
    socialAuth.openOAuthSession.mockResolvedValue({
      type: 'success',
      url: 'aido://auth/kakao?code=link-code',
      queryParams: { code: 'link-code' },
    });
    httpClient.post.mockResolvedValue(ok({ message: '소셜 계정이 연결되었습니다.' }));
    const [kakaoConnect] = screen.getAllByRole('button', { name: '연결' });
    if (kakaoConnect == null) {
      throw new Error('카카오 연결 단추가 없습니다');
    }

    // When
    await fireEvent.press(kakaoConnect);

    // Then
    expect(await screen.findByText('카카오 계정을 연결했어요')).toBeOnTheScreen();
    expect(socialAuth.openOAuthSession).toHaveBeenCalledWith({
      startPath: 'v1/auth/kakao/start',
      callbackPath: 'auth/kakao',
      params: { mode: 'link' },
    });
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/auth/link-with-code', { code: 'link-code' });
    expect(getTrackedEvents(analytics, 'auth_social_linked')).toEqual([{ provider: 'kakao' }]);
  });
});
