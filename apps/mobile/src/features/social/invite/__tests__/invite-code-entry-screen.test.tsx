import '@src/shared/i18n/init';
import type { ErrorCodeType } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createRouteParamsFake,
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router, useNavigation } from 'expo-router';

import InviteCodeEntryRoute from '../../../../../app/invite';
import { parseInviteCode } from '../domains/invite-code.model';
import { INVITE_QUERY_KEYS } from '../queries/invite-query-keys';
import { createInviteApiError, createInvitePreviewDto } from './invite.fixtures';

const CODE = parseInviteCode('K7M2QX') ?? '';

async function renderInviteCodeEntry(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  await renderScreen(<InviteCodeEntryRoute />, {
    di: createTestDi({
      ports: {
        httpClient,
        analytics,
        haptics,
        errorReporter: createErrorReporterStub(),
        queryClient: createTestQueryClient(),
      },
    }),
  });

  return { analytics, haptics };
}

async function enterCode(code: string) {
  const user = userEvent.setup();
  await user.paste(await screen.findByLabelText('초대 코드'), code);
  expect(await screen.findByRole('button', { name: '확인' })).toBeEnabled();
}

describe('초대 코드 입력 화면', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('오프라인이면 조회를 시작하지 않아 버튼이 돌며 멈추지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    onlineManager.setOnline(false);
    const user = userEvent.setup();
    await renderScreen(<InviteCodeEntryRoute />, {
      di: createTestDi({
        ports: {
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          queryClient,
        },
      }),
    });
    await user.paste(await screen.findByLabelText('초대 코드'), CODE);
    expect(await screen.findByRole('button', { name: '확인' })).toBeEnabled();

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await act(async () => undefined);
    expect(
      queryClient.getQueryState(INVITE_QUERY_KEYS.preview({ inviteCode: CODE })),
    ).toBeUndefined();
  });

  it('붙여 넣은 코드의 공백·하이픈·소문자를 맞춰 확인하면 미리보기를 캐시에 두고 초대 카드로 이동한다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createInvitePreviewDto()));
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();
    await renderScreen(<InviteCodeEntryRoute />, {
      di: createTestDi({
        ports: {
          httpClient,
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          queryClient,
        },
      }),
    });
    await user.paste(await screen.findByLabelText('초대 코드'), ' k7m-2qx ');
    expect(await screen.findByRole('button', { name: '확인' })).toBeEnabled();

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/invite/[inviteCode]',
        params: { inviteCode: CODE, source: 'code_entry' },
      }),
    );
    expect(queryClient.getQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: CODE }))).toBeDefined();
  });

  it('확인하는 중에 완료 키를 다시 눌러도 조회를 한 번만 한다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockReturnValue(new Promise(noop));
    const user = userEvent.setup();
    await renderScreen(<InviteCodeEntryRoute />, {
      di: createTestDi({
        ports: {
          httpClient,
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          queryClient: createTestQueryClient(),
        },
      }),
    });
    await user.paste(await screen.findByLabelText('초대 코드'), CODE);
    expect(await screen.findByRole('button', { name: '확인' })).toBeEnabled();
    await fireEvent(screen.getByLabelText('초대 코드'), 'submitEditing');

    // When
    await fireEvent(screen.getByLabelText('초대 코드'), 'submitEditing');

    // Then
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });

  it('채운 칸 뒤에 다른 코드를 붙여 넣으면 붙여 넣은 코드로 바꾼다', async () => {
    // Given
    const user = userEvent.setup();
    await renderScreen(<InviteCodeEntryRoute />, {
      di: createTestDi({
        ports: {
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          queryClient: createTestQueryClient(),
        },
      }),
    });
    const input = await screen.findByLabelText('초대 코드');
    await user.paste(input, 'BCDFGH');

    // When
    // 길게 눌러 붙여 넣으면 커서 뒤에 이어 붙은 글자가 한 번에 들어온다
    await fireEvent.changeText(input, 'BCDFGH k7m-2qx');

    // Then
    expect(input).toHaveDisplayValue(CODE);
  });

  it('헷갈리는 글자를 넣으면 제출 전에 바로 알리고 고칠 때까지 확인을 끈다', async () => {
    // Given
    const user = userEvent.setup();
    await renderScreen(<InviteCodeEntryRoute />, {
      di: createTestDi({
        ports: {
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          queryClient: createTestQueryClient(),
        },
      }),
    });
    const input = await screen.findByLabelText('초대 코드');

    // When
    await user.paste(input, 'K7M2Q0');

    // Then
    expect(await screen.findByText(/‘0’ 글자는 초대 코드에 없어요/u)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();

    // When
    await fireEvent.changeText(input, 'K7M2QX');

    // Then
    await waitFor(() => expect(screen.getByRole('button', { name: '확인' })).toBeEnabled());
    expect(screen.queryByText(/글자는 초대 코드에 없어요/u)).toBeNull();
  });
  it('앱 안에서 연 코드 입력으로 확인하면 초대 링크 열림을 한 번 남긴다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createInvitePreviewDto()));
    const { analytics } = await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'invite_link_opened'),
    ).toEqual([['invite_link_opened', { source: 'code_entry' }]]);
  });

  it('서버가 없는 코드라고 하면 코드 칸에 한 번만 알리고 고치면 알림을 지운다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(fail(createInviteApiError({ code: 'INVITE_2101' })));
    const { haptics } = await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    // Then
    expect(await screen.findAllByText('초대 코드를 찾을 수 없어요')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '다시 확인' })).toBeOnTheScreen();
    expect(screen.getByLabelText('초대 코드')).toHaveDisplayValue(CODE);
    expect(haptics.notify).not.toHaveBeenCalledWith('error');
    expect(router.replace).not.toHaveBeenCalled();

    // When
    await fireEvent.changeText(screen.getByLabelText('초대 코드'), 'BCDFGH');

    // Then
    await waitFor(() => expect(screen.queryByText('초대 코드를 찾을 수 없어요')).toBeNull());
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
  });

  it('연결이 끊겨 확인하지 못하면 한 번 알리고 코드를 둔 채 화면에 머문다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockRejectedValue(new NetworkError());
    const { haptics } = await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByLabelText('초대 코드')).toHaveDisplayValue(CODE);
    expect(screen.queryByTestId('invite-code-error')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    { code: 'INVITE_2102', reason: '링크가 바뀐 코드' },
    { code: 'INVITE_2103', reason: '내 코드' },
    { code: 'INVITE_2104', reason: '이미 다른 초대를 받은 계정' },
  ] satisfies ReadonlyArray<{ code: ErrorCodeType; reason: string }>)(
    '$reason($code)라고 거절되면 서버 문구를 코드 칸에 한 번 보이고 머문다',
    async ({ code }) => {
      // Given
      const error = createApiError(code, { status: 400 });
      const httpClient = createHttpClientStub();
      httpClient.get.mockResolvedValue(fail(error));
      const { haptics } = await renderInviteCodeEntry(httpClient);
      await enterCode(CODE);

      // When
      await fireEvent.press(screen.getByRole('button', { name: '확인' }));

      // Then
      expect(await screen.findByTestId('invite-code-error')).toHaveTextContent(error.message);
      expect(screen.getAllByText(error.message)).toHaveLength(1);
      expect(haptics.notify).not.toHaveBeenCalledWith('error');
      expect(router.replace).not.toHaveBeenCalled();
    },
  );

  it('초대가 꺼져 있으면 코드 칸이 아니라 토스트로 한 번 알리고 코드를 둔다', async () => {
    // Given
    const error = createApiError('INVITE_2105', { status: 403 });
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(fail(error));
    const { haptics } = await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    // Then
    expect(await screen.findAllByText(error.message)).toHaveLength(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.queryByTestId('invite-code-error')).toBeNull();
    expect(screen.getByLabelText('초대 코드')).toHaveDisplayValue(CODE);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('시스템 링크로 연 코드 입력은 착지할 때 한 번 남기고 확인해도 다시 남기지 않는다', async () => {
    // Given
    createRouteParamsFake({ source: 'app_scheme', openedAt: '1000' });
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createInvitePreviewDto()));
    const { analytics } = await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);

    // When
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'invite_link_opened'),
    ).toEqual([['invite_link_opened', { source: 'app_scheme' }]]);
  });

  it('같은 프레임에 확인을 두 번 누르면 조회가 두 번 나간다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const pending = createPendingResponse(ok(createInvitePreviewDto()));
    httpClient.get.mockReturnValue(pending.response);
    await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);
    const submit = screen.getByRole('button', { name: '확인' });

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
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it('덜 채운 코드는 완료 키를 눌러도 조회하지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    await renderInviteCodeEntry(httpClient);
    const input = await screen.findByLabelText('초대 코드');
    await fireEvent.changeText(input, 'K7M2');

    // When
    await fireEvent(input, 'submitEditing');

    // Then
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('확인하는 사이 화면을 떠났으면 조회가 끝나도 초대 카드로 바꾸지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const httpClient = createHttpClientStub();
    const pending = createPendingResponse(ok(createInvitePreviewDto()));
    httpClient.get.mockReturnValue(pending.response);
    const { analytics } = await renderInviteCodeEntry(httpClient);
    await enterCode(CODE);
    await act(async () => {
      // 누름은 응답이 와야 끝나 기다리지 않는다
      fireEvent.press(screen.getByRole('button', { name: '확인' })).catch(() => undefined);
    });

    // When
    isFocused = false;
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(screen.getByRole('button', { name: '확인' })).toBeEnabled());
    expect(router.replace).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('invite_link_opened', expect.anything());
  });
});
