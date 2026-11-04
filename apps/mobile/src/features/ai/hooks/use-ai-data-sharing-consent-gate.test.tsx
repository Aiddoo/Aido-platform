import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { createConsent } from '@src/features/auth/__tests__/auth.factories';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { AUTH_QUERY_KEYS } from '@src/features/auth/constants/auth-query-keys';
import type { Consent } from '@src/features/auth/domains/auth.model';
import { createCoachmarkRepository } from '@src/features/feature-discovery/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { UserService } from '@src/features/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import {
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockTokenStore,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { Button, Text } from '@src/shared/ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { useAiDataSharingConsentGate } from './use-ai-data-sharing-consent-gate';

jest.mock('@src/shared/config/env', () => ({
  ENV: { API_URL: 'http://test', SOCIAL_AUTH_REDIRECT_URL: 'http://test' },
}));

const RENEWAL_NOTICE = '지금 답하지 않아도 AI 기능은 이전 동의 범위로 그대로 쓸 수 있어요.';

function ConsentGateProbe() {
  const gate = useAiDataSharingConsentGate();
  const [result, setResult] = useState('');

  return (
    <>
      <Button onPress={async () => setResult(JSON.stringify(await gate.ensureAgreed()))}>
        시작
      </Button>
      <Button onPress={async () => setResult(JSON.stringify(await gate.ensureAgreedOnce()))}>
        계정당 한 번 시작
      </Button>
      <Text>{result}</Text>
    </>
  );
}

async function renderGate(
  consentOverrides: Partial<Consent>,
  { me = { id: 'account-1' } }: { me?: { id: string } | null } = {},
) {
  const authHttp = createMockHttpClient();
  const userHttp = createMockHttpClient();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), createConsent(consentOverrides));
  if (me != null) {
    queryClient.setQueryData(USER_QUERY_KEYS.me(), me);
  }

  await renderUi(
    <OverlayProvider>
      <ConsentGateProbe />
    </OverlayProvider>,
    {
      di: {
        analytics: createMockAnalytics(),
        haptics: createHapticsStub(),
        logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        authService: new AuthService(createMockHttpClient(), authHttp, createMockTokenStore()),
        userService: new UserService(userHttp),
        coachmarkService: new CoachmarkService(
          createCoachmarkRepository(createMemorySyncStorage()),
        ),
      },
      queryClient,
    },
  );

  return { authHttp, userHttp };
}

describe('useAiDataSharingConsentGate', () => {
  test('이전 안내에 동의한 사람에게는 바뀐 안내를 보여 주고 나중에를 눌러도 서버로 보내지 않고 이어 간다', async () => {
    // Given
    const { authHttp } = await renderGate({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    });

    // When
    fireEvent.press(screen.getByText('시작'));
    await screen.findByText(RENEWAL_NOTICE);
    fireEvent.press(screen.getByTestId('ai-consent-later'));

    // Then
    await screen.findByText(JSON.stringify({ isAgreed: true, wasAsked: true }));
    expect(authHttp.patch).not.toHaveBeenCalled();
  });

  test('바뀐 안내는 계정마다 한 번만 보여 준다', async () => {
    // Given
    await renderGate({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    });
    fireEvent.press(screen.getByText('시작'));
    await screen.findByText(RENEWAL_NOTICE);
    fireEvent.press(screen.getByTestId('ai-consent-later'));
    await screen.findByText(JSON.stringify({ isAgreed: true, wasAsked: true }));

    // When
    fireEvent.press(screen.getByText('시작'));

    // Then
    await screen.findByText(JSON.stringify({ isAgreed: true, wasAsked: false }));
  });

  test('내 정보를 아직 못 받았으면 받을 때까지 기다린 뒤 재안내를 보여 준다', async () => {
    // Given
    const { userHttp } = await renderGate(
      { aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: '2026-10-26' },
      { me: null },
    );
    userHttp.get.mockResolvedValue(ok(createCurrentUserDto()));

    // When
    fireEvent.press(screen.getByText('계정당 한 번 시작'));

    // Then
    await screen.findByText(RENEWAL_NOTICE);
    expect(userHttp.get).toHaveBeenCalledTimes(1);
  });

  test('내 정보를 읽지 못하면 묻지 않고 서버 판단에 맡긴다', async () => {
    // Given
    const { userHttp } = await renderGate(
      { aiDataSharingDecision: 'AGREED', aiDataSharingConsentVersion: '2026-10-26' },
      { me: null },
    );
    userHttp.get.mockRejectedValue(new Error('offline'));

    // When
    fireEvent.press(screen.getByText('계정당 한 번 시작'));

    // Then
    await screen.findByText(JSON.stringify({ isAgreed: true, wasAsked: false }));
    expect(screen.queryByText(RENEWAL_NOTICE)).toBeNull();
  });

  test('현재 안내에 동의했으면 묻지 않는다', async () => {
    // Given
    await renderGate({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    });

    // When
    fireEvent.press(screen.getByText('시작'));

    // Then
    await screen.findByText(JSON.stringify({ isAgreed: true, wasAsked: false }));
    await waitFor(() => expect(screen.queryByText(RENEWAL_NOTICE)).toBeNull());
  });
});
