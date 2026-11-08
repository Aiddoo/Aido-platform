import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { useClaimAiConsentRenewal } from '@src/features/device/coachmark/hooks/use-claim-ai-consent-renewal';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createHttpClientStub, createTestQueryClient, renderUi } from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors';
import { Button, Text } from '@src/shared/ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { useState } from 'react';

import { createConsent } from '../__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '../constants/consent-query-keys';
import type { Consent } from '../schemas/consent.schema';
import {
  AI_CONSENT_CHECK_TIMEOUT_MS,
  readWithoutBlocking,
  useAiDataSharingConsentGate,
} from './use-ai-data-sharing-consent-gate';

const RENEWAL_NOTICE = '지금 답하지 않아도 전처럼 쓸 수 있어요.';

function ConsentGateProbe() {
  const claimRenewalPrompt = useClaimAiConsentRenewal();
  const gate = useAiDataSharingConsentGate({ claimRenewalPrompt });
  const [result, setResult] = useState('');
  const [settledCount, setSettledCount] = useState(0);

  return (
    <>
      <Button
        onPress={() => {
          [1, 2].forEach(async () => {
            await gate.requestAgreementIfNeeded();
            setSettledCount((count) => count + 1);
          });
        }}
      >
        두 번 시작
      </Button>
      <Text>{`끝난 요청 ${settledCount}개`}</Text>
      <Button
        onPress={async () => setResult(JSON.stringify(await gate.requestAgreementIfNeeded()))}
      >
        시작
      </Button>
      <Button
        onPress={async () =>
          setResult(JSON.stringify(await gate.requestAgreementBeforeListening()))
        }
      >
        듣기 전 확인
      </Button>
      <Text>{result}</Text>
    </>
  );
}

async function renderGate(
  consentOverrides: Partial<Consent> | null,
  { me = { id: 'account-1' } }: { me?: { id: string } | null } = {},
) {
  const httpClient = createHttpClientStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  if (consentOverrides != null) {
    queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), createConsent(consentOverrides));
  }
  if (me != null) {
    queryClient.setQueryData(USER_QUERY_KEYS.me(), me);
  }

  await renderUi(
    <OverlayProvider>
      <ConsentGateProbe />
    </OverlayProvider>,
    {
      di: { httpClient },
      queryClient,
    },
  );

  return { httpClient };
}

describe('readWithoutBlocking', () => {
  it('연결이 있어도 응답이 오지 않으면 제한 시간 뒤 없는 값으로 이어 간다', async () => {
    // Given
    jest.useFakeTimers();
    const result = readWithoutBlocking(undefined, () => new Promise(() => undefined), noop);

    // When
    await jest.advanceTimersByTimeAsync(AI_CONSENT_CHECK_TIMEOUT_MS);

    // Then
    await expect(result).resolves.toBeNull();
    jest.useRealTimers();
  });
});

describe('useAiDataSharingConsentGate', () => {
  describe('연결이 없을 때', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('동의 상태가 캐시에 없으면 묻지 않고 듣기로 이어 간다', async () => {
      // Given
      onlineManager.setOnline(false);
      await renderGate(null, { me: null });

      // When
      fireEvent.press(screen.getByText('듣기 전 확인'));

      // Then
      expect(
        await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: false })),
      ).toBeTruthy();
    });

    it('동의 상태가 캐시에 없으면 AI 시작도 막지 않고 서버 판단에 맡긴다', async () => {
      // Given
      onlineManager.setOnline(false);
      await renderGate(null, { me: null });

      // When
      fireEvent.press(screen.getByText('시작'));

      // Then
      expect(
        await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: false })),
      ).toBeTruthy();
    });

    it('캐시에 동의가 있으면 내 정보를 기다리지 않고 이어 간다', async () => {
      // Given
      onlineManager.setOnline(false);
      await renderGate({ aiDataSharingDecision: 'AGREED' }, { me: null });

      // When
      fireEvent.press(screen.getByText('듣기 전 확인'));

      // Then
      expect(
        await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: false })),
      ).toBeTruthy();
    });

    it('캐시가 미응답이면 안내를 띄우고 동의 저장은 멈춰 있지 않고 바로 실패해 시트를 그대로 둔다', async () => {
      // Given
      onlineManager.setOnline(false);
      const { httpClient } = await renderGate({});
      httpClient.patch.mockRejectedValue(new NetworkError());
      fireEvent.press(screen.getByText('듣기 전 확인'));

      // When
      fireEvent.press(await screen.findByTestId('ai-consent-agree'));

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId('ai-consent-later')).not.toBeDisabled());
      expect(screen.getByTestId('ai-consent-sheet')).toBeTruthy();
    });
  });

  it('안내가 떠 있는 동안 한 번 더 시작해도 두 요청이 모두 답을 받고 끝난다', async () => {
    // Given
    // 안내가 열린 채 마이크를 한 번 더 눌렀다
    await renderGate({});

    // When
    fireEvent.press(screen.getByText('두 번 시작'));
    fireEvent.press(await screen.findByTestId('ai-consent-later'));

    // Then
    // 앞 요청이 시트에 밀려 영영 끝나지 않으면 두 번째까지만 센다
    expect(await screen.findByText('끝난 요청 2개')).toBeTruthy();
  });

  it('듣기 전 확인에서 미응답이 나중에를 누르면 멈추라고 알리고 다시 물으면 또 안내한다', async () => {
    // Given
    const { httpClient } = await renderGate({});
    fireEvent.press(screen.getByText('듣기 전 확인'));
    fireEvent.press(await screen.findByTestId('ai-consent-later'));
    await screen.findByText(JSON.stringify({ hasAgreed: false, wasAsked: true }));
    await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());

    // When
    fireEvent.press(screen.getByText('듣기 전 확인'));

    // Then
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('이전 안내에 동의한 사람에게는 바뀐 안내를 보여 주고 나중에를 눌러도 서버로 보내지 않고 이어 간다', async () => {
    // Given
    const { httpClient } = await renderGate({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    });

    // When
    fireEvent.press(screen.getByText('시작'));
    await screen.findByText(RENEWAL_NOTICE);
    fireEvent.press(screen.getByTestId('ai-consent-later'));

    // Then
    await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: true }));
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('바뀐 안내는 계정마다 한 번만 보여 준다', async () => {
    // Given
    await renderGate({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    });
    fireEvent.press(screen.getByText('시작'));
    await screen.findByText(RENEWAL_NOTICE);
    fireEvent.press(screen.getByTestId('ai-consent-later'));
    await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: true }));

    // When
    fireEvent.press(screen.getByText('시작'));

    // Then
    expect(
      await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: false })),
    ).toBeTruthy();
  });

  it('내 정보를 아직 못 받았으면 받을 때까지 기다린 뒤 재안내를 보여 준다', async () => {
    // Given
    const { httpClient } = await renderGate(
      { aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: '2026-10-26' },
      { me: null },
    );
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));

    // When
    fireEvent.press(screen.getByText('듣기 전 확인'));

    // Then
    await screen.findByText(RENEWAL_NOTICE);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });

  it('내 정보를 읽지 못하면 묻지 않고 서버 판단에 맡긴다', async () => {
    // Given
    const { httpClient } = await renderGate(
      { aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: '2026-10-26' },
      { me: null },
    );
    httpClient.get.mockRejectedValue(new Error('offline'));

    // When
    fireEvent.press(screen.getByText('듣기 전 확인'));

    // Then
    await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: false }));
    expect(screen.queryByText(RENEWAL_NOTICE)).toBeNull();
  });

  it('현재 안내에 동의했으면 묻지 않는다', async () => {
    // Given
    await renderGate({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    });

    // When
    fireEvent.press(screen.getByText('시작'));

    // Then
    await screen.findByText(JSON.stringify({ hasAgreed: true, wasAsked: false }));
    await waitFor(() => expect(screen.queryByText(RENEWAL_NOTICE)).toBeNull());
  });
});
