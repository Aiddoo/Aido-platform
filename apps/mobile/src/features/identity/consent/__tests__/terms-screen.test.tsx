import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestDi,
  getTrackedEvents,
  silenceConsole,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import TermsSettingsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/terms';
import { createConsentDto } from './consent.fixtures';

const AI_DATA_SHARING_PATH = 'v1/auth/consent/ai-data-sharing';
const AI_DATA_SHARING_SWITCH = /^AI 기능 데이터 제공/;
const AGREED_AT = '2026-11-20T03:00:00.000Z';

const AGREED_CONSENT = createConsentDto({
  aiDataSharingDecision: 'AGREED',
  aiDataSharingAgreedAt: AGREED_AT,
  aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
});

async function renderTerms(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  await renderScreen(<TermsSettingsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });

  return { analytics };
}

describe('TermsSettingsScreen', () => {
  it('AI 기능 데이터 제공을 켜면 지금 안내 버전으로 한 번 동의하고 켠 채로 둔다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createConsentDto()));
    httpClient.patch.mockResolvedValue(
      ok({
        aiDataSharingDecision: 'AGREED',
        aiDataSharingAgreedAt: AGREED_AT,
        aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
      }),
    );
    const { analytics } = await renderTerms(httpClient);

    // When
    await userEvent.press(await screen.findByRole('switch', { name: AI_DATA_SHARING_SWITCH }));

    // Then
    await waitFor(() =>
      expect(getTrackedEvents(analytics, 'ai_data_sharing_consent_changed')).toEqual([
        { agreed: true },
      ]),
    );
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith(AI_DATA_SHARING_PATH, {
      agreed: true,
      version: AI_DATA_SHARING_CONSENT.VERSION,
    });
    expect(screen.getByRole('switch', { name: AI_DATA_SHARING_SWITCH })).toBeChecked();
  });

  it('동의를 끄면 철회를 확인받은 뒤에 한 번 철회한다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(AGREED_CONSENT));
    httpClient.patch.mockResolvedValue(
      ok({
        aiDataSharingDecision: 'DECLINED',
        aiDataSharingAgreedAt: null,
        aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
      }),
    );
    await renderTerms(httpClient);
    await act(async () => {
      // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않아 기다리지 않는다
      userEvent
        .press(await screen.findByRole('switch', { name: AI_DATA_SHARING_SWITCH }))
        .catch(() => undefined);
    });
    await screen.findByText('동의를 철회할까요?');
    expect(httpClient.patch).not.toHaveBeenCalled();

    // When
    await fireEvent.press(screen.getByTestId('ai-data-sharing-withdraw-confirm'));

    // Then
    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(AI_DATA_SHARING_PATH, {
        agreed: false,
        version: AI_DATA_SHARING_CONSENT.VERSION,
      }),
    );
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('꺼져 있어요. 켜면 다시 쓸 수 있어요.')).toBeOnTheScreen();
  });

  it('동의를 저장하지 못하면 알리고 꺼진 채로 되돌린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createConsentDto()));
    httpClient.patch.mockRejectedValue(new NetworkError());
    const { analytics } = await renderTerms(httpClient);

    // When
    await userEvent.press(await screen.findByRole('switch', { name: AI_DATA_SHARING_SWITCH }));

    // Then
    expect(await screen.findByText('인터넷 연결을 확인해주세요')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: AI_DATA_SHARING_SWITCH })).not.toBeChecked(),
    );
    expect(screen.getByText('AI 기능을 처음 쓸 때 물어봐요.')).toBeOnTheScreen();
    expect(getTrackedEvents(analytics, 'ai_data_sharing_consent_changed')).toEqual([]);
  });

  it('동의 내역을 받지 못하면 다시 시도를 보이고 누르면 다시 받아 약관을 보인다', async () => {
    // Given
    // 조회 경계가 잡은 오류를 React가 console.error로 다시 찍는다
    silenceConsole('error');
    const httpClient = createHttpClientStub();
    httpClient.get
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValue(ok(createConsentDto()));
    await renderTerms(httpClient);

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

    // Then
    expect(await screen.findByText('서비스 이용약관')).toBeOnTheScreen();
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
});
