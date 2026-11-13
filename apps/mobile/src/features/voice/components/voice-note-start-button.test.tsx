import '@src/shared/i18n/init';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import {
  createHttpClientStub,
  createRouteParamsFake,
  createSpeechRecognizerStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { VoiceNoteStartButton } from './voice-note-start-button';

const ACCOUNT_ID = 'user-1';

async function renderButton(routeParams: Record<string, string>) {
  createRouteParamsFake(routeParams);
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();
  const { syncStorage } = createCoachmarkStorage([
    { accountId: ACCOUNT_ID, kind: 'voice-note-start' },
  ]);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  // 아직 AI 데이터 이용에 답하지 않은 계정
  queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), createConsent());

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <VoiceNoteStartButton coachmarkPlacement="bottom" />
      </OverlayProvider>
    </LocalDateProvider>,
    { di: createTestDi({ ports: { httpClient, syncStorage, speechRecognizer, queryClient } }) },
  );

  return { speechRecognizer };
}

describe('VoiceNoteStartButton', () => {
  describe('시작 요청', () => {
    setupFakeTimersPerTest({ advanceTimers: true });

    it('다른 화면이 시작을 요청하고 들어오면 이 화면에서 AI 동의 시트를 바로 띄우고 요청을 지운다', async () => {
      // When
      const { speechRecognizer } = await renderButton({ startVoiceNote: '1' });

      // Then
      expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
      expect(router.setParams).toHaveBeenCalledWith({ startVoiceNote: undefined });
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    });

    it('요청 없이 들어오면 누르기 전까지 아무것도 묻지 않는다', async () => {
      // When
      await renderButton({});

      // Then
      expect(screen.getByTestId('voice-note-start')).toBeTruthy();
      expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
      expect(router.setParams).not.toHaveBeenCalled();
    });

    it('같은 화면에 머문 채 시작 요청이 다시 오면 또 시작한다', async () => {
      // Given
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderButton({ startVoiceNote: '1' });
      await user.press(await screen.findByTestId('ai-consent-later'));
      await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());

      // When
      await act(async () => router.setParams({ startVoiceNote: '1' }));

      // Then
      expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    });
  });
});
