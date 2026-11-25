import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { createHttpClientStub, createPendingResponse, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ChangePasswordRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/change-password';
import { givenAndroidBack } from './auth-step.test-utils';
import { createAuthApiError, createChangePasswordDto } from './auth.fixtures';

const CURRENT_PASSWORD = 'fake-current1';
const NEW_PASSWORD = 'FakeNew1234';
const CURRENT_STEP_TITLE = '현재 비밀번호를\n입력해주세요';
const NEW_PASSWORD_STEP_TITLE = '영문 숫자를 포함한\n새 비밀번호를 설정해주세요';
const CURRENT_PLACEHOLDER = '현재 비밀번호를 입력해주세요';
const NEW_PLACEHOLDER = '새 비밀번호를 입력해주세요';
const CONFIRM_PLACEHOLDER = '새 비밀번호를 다시 입력해주세요';
const SUBMIT = '비밀번호 변경';
const DISALLOWED_CHARACTER_NOTICE = '쓸 수 없는 문자가 있어요. 특수문자는 @$!%*#?&만 쓸 수 있어요';

async function renderChangePassword(httpClient: ReturnType<typeof createHttpClientStub>) {
  await renderScreen(<ChangePasswordRoute />, { di: createTestDi({ ports: { httpClient } }) });
}

async function pressNext() {
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
}

async function fillCurrentPasswordStep(currentPassword = CURRENT_PASSWORD) {
  await fireEvent.changeText(
    await screen.findByPlaceholderText(CURRENT_PLACEHOLDER),
    currentPassword,
  );
  await pressNext();
}

async function fillAllSteps() {
  await fillCurrentPasswordStep();
  await fireEvent.changeText(await screen.findByPlaceholderText(NEW_PLACEHOLDER), NEW_PASSWORD);
  await pressNext();
  await fireEvent.changeText(await screen.findByPlaceholderText(CONFIRM_PLACEHOLDER), NEW_PASSWORD);
}

describe('비밀번호 변경 화면', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    httpClient = createHttpClientStub();
  });

  it('현재 비밀번호, 새 비밀번호, 확인 순서로 칸을 열고 마지막 단계에서만 변경 버튼을 보인다', async () => {
    // Given
    await renderChangePassword(httpClient);
    expect(await screen.findByText(CURRENT_STEP_TITLE)).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    // When
    await fillCurrentPasswordStep();

    // Then
    expect(await screen.findByText(NEW_PASSWORD_STEP_TITLE)).toBeTruthy();
    expect(screen.queryByPlaceholderText(CURRENT_PLACEHOLDER)).toBeNull();
    expect(screen.queryByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeNull();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    // When
    await fireEvent.changeText(screen.getByPlaceholderText(NEW_PLACEHOLDER), NEW_PASSWORD);
    await pressNext();

    // Then
    expect(await screen.findByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByPlaceholderText(NEW_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
  });

  it('Android 뒤로 가기는 한 단계씩 돌아가고 적은 값을 지킨다', async () => {
    // Given
    const androidBack = givenAndroidBack();
    await renderChangePassword(httpClient);
    await fillAllSteps();

    // When
    await androidBack.press();

    // Then
    expect(screen.queryByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeNull();
    expect(screen.getByPlaceholderText(NEW_PLACEHOLDER).props.value).toBe(NEW_PASSWORD);

    // When
    await androidBack.press();

    // Then
    expect(await screen.findByText(CURRENT_STEP_TITLE)).toBeTruthy();
    expect(screen.getByPlaceholderText(CURRENT_PLACEHOLDER).props.value).toBe(CURRENT_PASSWORD);
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('새 비밀번호를 적어도 확인 칸에 적기 전에는 일치하지 않는다는 오류를 보이지 않는다', async () => {
    // Given
    await renderChangePassword(httpClient);
    await fillCurrentPasswordStep();
    await fireEvent.changeText(await screen.findByPlaceholderText(NEW_PLACEHOLDER), NEW_PASSWORD);

    // When
    await pressNext();
    const confirmInput = await screen.findByPlaceholderText(CONFIRM_PLACEHOLDER);

    // Then
    expect(screen.queryByText('비밀번호가 일치하지 않아요')).toBeNull();

    // When
    await fireEvent.changeText(confirmInput, 'FakeNew12');

    // Then
    expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeTruthy();
  });

  it('확인 칸이 다르면 변경 버튼이 꺼져 키보드 완료로도 요청하지 않는다', async () => {
    // Given
    await renderChangePassword(httpClient);
    await fillCurrentPasswordStep();
    await fireEvent.changeText(await screen.findByPlaceholderText(NEW_PLACEHOLDER), NEW_PASSWORD);
    await pressNext();
    const confirmInput = await screen.findByPlaceholderText(CONFIRM_PLACEHOLDER);
    await fireEvent.changeText(confirmInput, 'FakeNew12');

    // When
    await fireEvent(confirmInput, 'submitEditing');

    // Then
    expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('새 비밀번호에 쓸 수 없는 문자가 있으면 이유를 보이고 고치면 다음으로 갈 수 있다', async () => {
    // Given
    await renderChangePassword(httpClient);
    await fillCurrentPasswordStep();
    const newPasswordInput = await screen.findByPlaceholderText(NEW_PLACEHOLDER);

    // When
    await fireEvent.changeText(newPasswordInput, 'abcd1234.');

    // Then
    expect(screen.getByText(DISALLOWED_CHARACTER_NOTICE)).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    // When
    await fireEvent.changeText(newPasswordInput, 'abcd1234!');

    // Then
    expect(screen.queryByText(DISALLOWED_CHARACTER_NOTICE)).toBeNull();
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('바꾸면 세 칸을 한 번 보내고 성공을 알린 뒤 앞 화면으로 돌아간다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(ok(createChangePasswordDto()));
    await renderChangePassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/password', {
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      newPasswordConfirm: NEW_PASSWORD,
    });
    expect(await screen.findAllByText('비밀번호가 변경되었어요')).toHaveLength(1);
  });

  it('돌아갈 화면이 없으면 바꾼 뒤 프로필 설정으로 간다', async () => {
    // Given
    jest.mocked(router.canGoBack).mockReturnValue(false);
    httpClient.patch.mockResolvedValue(ok(createChangePasswordDto()));
    await renderChangePassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/settings/profile'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('변경 버튼을 연달아 눌러도 요청은 한 번이다', async () => {
    // Given
    const pending = createPendingResponse(ok(createChangePasswordDto()));
    httpClient.patch.mockReturnValue(pending.response);
    await renderChangePassword(httpClient);
    await fillAllSteps();
    const submit = screen.getByRole('button', { name: SUBMIT });

    // When
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    pending.settle();

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('현재 비밀번호가 틀리면 그 단계로 돌아가 칸에 알리고 새 비밀번호를 지킨다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(
      fail(createAuthApiError({ code: 'USER_0602', status: 401 })),
    );
    await renderChangePassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    expect(await screen.findByText('현재 비밀번호가 일치하지 않아요')).toBeTruthy();
    expect(screen.getByText(CURRENT_STEP_TITLE)).toBeTruthy();
    expect(screen.getByDisplayValue(CURRENT_PASSWORD)).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.queryByText(i18n.t('errors:USER_0602'))).toBeNull();
    expect(router.back).not.toHaveBeenCalled();

    // When
    await fireEvent.changeText(screen.getByDisplayValue(CURRENT_PASSWORD), 'fake-current2');
    await pressNext();
    await pressNext();

    // Then
    expect(await screen.findAllByDisplayValue(NEW_PASSWORD)).toHaveLength(2);
  });

  it('서버가 거절하면 이유를 한 번 알리고 두 단계에 적은 값을 지킨다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(
      fail(createAuthApiError({ status: 400, message: '서버가 거절한 이유' })),
    );
    await renderChangePassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(await screen.findAllByText('서버가 거절한 이유')).toHaveLength(1);
    expect(screen.getAllByDisplayValue(NEW_PASSWORD)).toHaveLength(2);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('연결이 끊겨 실패하면 한 번 안내하고 마지막 단계에 머물러 다시 누를 수 있다', async () => {
    // Given
    httpClient.patch.mockRejectedValue(new NetworkError());
    await renderChangePassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).toHaveLength(1);
    expect(screen.getAllByDisplayValue(NEW_PASSWORD)).toHaveLength(2);
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(router.back).not.toHaveBeenCalled();
  });
});
