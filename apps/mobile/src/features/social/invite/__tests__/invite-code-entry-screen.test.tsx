import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';

import InviteCodeEntryRoute from '../../../../../app/invite';
import { parseInviteCode } from '../domains/invite-code.model';
import { INVITE_QUERY_KEYS } from '../queries/invite-query-keys';
import { createInvitePreviewDto } from './invite.fixtures';

const CODE = parseInviteCode('K7M2QX') ?? '';

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
      di: {
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      },
      queryClient,
    });
    await user.paste(await screen.findByLabelText('초대 코드'), CODE);
    expect(await screen.findByRole('button', { name: '확인' })).toBeEnabled();

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    // oxlint-disable-next-line aido/no-real-sleep -- 1.15.2 전환 #1400
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
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
      di: {
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      },
      queryClient,
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
      di: {
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      },
      queryClient: createTestQueryClient(),
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
      di: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub() },
      queryClient: createTestQueryClient(),
    });
    const input = await screen.findByLabelText('초대 코드');
    await user.paste(input, 'BCDFGH');

    // When
    // 길게 눌러 붙여 넣으면 커서 뒤에 이어 붙은 글자가 한 번에 들어온다
    await fireEvent.changeText(input, 'BCDFGH k7m-2qx');

    // Then
    expect(input).toHaveDisplayValue(CODE);
  });
});
