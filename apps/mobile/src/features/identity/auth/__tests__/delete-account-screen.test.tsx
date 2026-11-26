import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { NetworkError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import {
  createHttpClientStub,
  createMemoryTokenStore,
  createPendingResponse,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { pressTwiceInSameFrame } from '@src/testing/press';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

import DeleteAccountScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/delete-account';
import { ACCOUNT_A_TOKENS } from './auth-session.test-utils';
import { createAuthApiError, createDeleteAccountDto } from './auth.fixtures';
import { createAuthSessionStoreStub } from './create-auth-session-store-stub';

const PASSWORD = 'fake-pass1';
const DELETE_BUTTON = '탈퇴하기';
const DIALOG_MESSAGE = /정말 탈퇴하시겠어요/;

async function renderDeleteAccount(httpClient: ReturnType<typeof createHttpClientStub>) {
  httpClient.get.mockImplementation(respondByPath({ 'v1/auth/me': ok(createCurrentUserDto()) }));
  const authSessionStore = createAuthSessionStoreStub('authenticated');
  const tokenStore = createMemoryTokenStore(ACCOUNT_A_TOKENS);
  await renderScreen(<DeleteAccountScreen />, {
    di: createTestDi({ ports: { httpClient, tokenStore }, seeds: { authSessionStore } }),
    withOverlay: true,
  });
  return { authSessionStore, tokenStore };
}

/**
 * 확인 다이얼로그의 답을 기다리는 동안 화면 버튼의 누름은 끝나지 않는다. 다이얼로그가 뜰 때까지만 기다리고 누름은 감싸 돌려준다.
 * async 함수가 Promise를 그대로 돌려주면 그 누름이 끝날 때까지 기다려 다이얼로그에 답할 수 없다
 */
async function openConfirmDialog(password: string) {
  await fireEvent.changeText(
    await screen.findByPlaceholderText('비밀번호를 입력해주세요'),
    password,
  );
  const submitting = fireEvent.press(screen.getByRole('button', { name: DELETE_BUTTON }));
  await screen.findByText(DIALOG_MESSAGE);
  return { submitting };
}

function getDialogConfirmButton() {
  const confirm = screen.getAllByRole('button', { name: DELETE_BUTTON }).at(-1);
  if (confirm == null) {
    throw new Error('confirm button required');
  }
  return confirm;
}

describe('DeleteAccountScreen', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    httpClient = createHttpClientStub();
  });

  it('비밀번호를 적기 전에는 탈퇴 버튼이 꺼져 있다', async () => {
    // When
    await renderDeleteAccount(httpClient);

    // Then
    expect(await screen.findByRole('button', { name: DELETE_BUTTON })).toBeDisabled();
    expect(httpClient.delete).not.toHaveBeenCalled();
  });

  it('확인 다이얼로그를 취소하면 탈퇴를 요청하지 않고 적은 비밀번호를 지킨다', async () => {
    // Given
    await renderDeleteAccount(httpClient);
    const { submitting } = await openConfirmDialog(PASSWORD);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await submitting;

    // Then
    expect(screen.queryByText(DIALOG_MESSAGE)).toBeNull();
    expect(httpClient.delete).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(PASSWORD)).toBeTruthy();
  });

  it('확인하면 적은 비밀번호로 탈퇴를 요청하고 이 기기의 토큰을 지운 뒤 로그아웃한다', async () => {
    // Given
    httpClient.delete.mockResolvedValue(ok(createDeleteAccountDto()));
    const { authSessionStore, tokenStore } = await renderDeleteAccount(httpClient);
    const { submitting } = await openConfirmDialog(PASSWORD);

    // When
    await fireEvent.press(getDialogConfirmButton());
    await submitting;

    // Then
    await waitFor(() => expect(authSessionStore.getSnapshot().status).toBe('unauthenticated'));
    expect(httpClient.delete).toHaveBeenCalledWith('v1/auth/account', {
      body: { password: PASSWORD },
    });
    expect(await screen.findAllByText('계정이 탈퇴 처리되었어요')).toHaveLength(1);
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('확인 버튼을 연달아 눌러도 탈퇴 요청은 한 번이다', async () => {
    // Given
    const pending = createPendingResponse(ok(createDeleteAccountDto()));
    httpClient.delete.mockReturnValue(pending.response);
    const { authSessionStore } = await renderDeleteAccount(httpClient);
    const { submitting } = await openConfirmDialog(PASSWORD);

    // When
    const confirm = getDialogConfirmButton();
    const firstPress = fireEvent.press(confirm);
    await waitFor(() => expect(httpClient.delete).toHaveBeenCalled());
    const secondPress = fireEvent.press(confirm);
    pending.settle();
    await Promise.all([firstPress, secondPress, submitting]);

    // Then
    await waitFor(() => expect(authSessionStore.getSnapshot().status).toBe('unauthenticated'));
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });

  it('비밀번호가 틀리면 토스트 대신 그 칸에 알리고 적은 값을 지킨다', async () => {
    // Given
    httpClient.delete.mockResolvedValue(
      fail(createAuthApiError({ code: 'USER_0602', status: 401 })),
    );
    const { authSessionStore, tokenStore } = await renderDeleteAccount(httpClient);
    const { submitting } = await openConfirmDialog('wrong-pass1');

    // When
    await fireEvent.press(getDialogConfirmButton());
    await submitting;

    // Then
    expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeTruthy();
    expect(screen.queryByText(DIALOG_MESSAGE)).toBeNull();
    expect(screen.getByDisplayValue('wrong-pass1')).toBeTruthy();
    expect(screen.queryByText(i18n.t('errors:USER_0602'))).toBeNull();
    expect(authSessionStore.getSnapshot().status).toBe('authenticated');
    await expect(tokenStore.getRefreshToken()).resolves.toBe(ACCOUNT_A_TOKENS.refreshToken);
  });

  it('비밀번호 밖의 이유로 실패하면 한 번 안내하고 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    httpClient.delete.mockRejectedValue(new NetworkError());
    const { authSessionStore } = await renderDeleteAccount(httpClient);
    const { submitting } = await openConfirmDialog(PASSWORD);

    // When
    await fireEvent.press(getDialogConfirmButton());

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).toHaveLength(1);
    expect(screen.getByText(DIALOG_MESSAGE)).toBeOnTheScreen();
    expect(getDialogConfirmButton()).toBeEnabled();
    expect(screen.getByDisplayValue(PASSWORD)).toBeTruthy();
    expect(authSessionStore.getSnapshot().status).toBe('authenticated');
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await submitting;
  });

  it('탈퇴하기를 같은 프레임에 두 번 눌러도 확인 다이얼로그를 한 번만 연다', async () => {
    // Given
    await renderDeleteAccount(httpClient);
    await fireEvent.changeText(
      await screen.findByPlaceholderText('비밀번호를 입력해주세요'),
      PASSWORD,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: DELETE_BUTTON })).toBeEnabled());
    const submit = screen.getByRole('button', { name: DELETE_BUTTON });
    jest.mocked(KeyboardController.dismiss).mockClear();

    // When
    await pressTwiceInSameFrame(submit);

    // Then
    expect(await screen.findAllByText(DIALOG_MESSAGE)).toHaveLength(1);
    // 다이얼로그를 열기 전에 키보드를 내려, 그 횟수가 다이얼로그를 연 횟수다
    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
  });
});
