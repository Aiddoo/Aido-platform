import '@src/shared/i18n/init';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createAllSeenCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { NetworkError } from '@src/shared/errors';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import {
  createHttpClientStub,
  createAppLoggerStub,
  createMemoryKeyValueStorage,
  createPendingResponse,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { createSpokenVoiceNote } from '../__tests__/voice-note.fixtures';
import { createVoiceNoteDigestDto } from '../__tests__/voice.fixtures';
import { useVoiceNoteDigest } from './use-voice-note-digest';

const ACCOUNT_ID = 'user-1';
const DRAFT_ID = 'draft-1';
let logger: ReturnType<typeof createAppLoggerStub>;

beforeEach(() => {
  logger = createAppLoggerStub();
});

function DigestProbe() {
  const { digest, isPending, failure } = useVoiceNoteDigest({
    accountId: ACCOUNT_ID,
    draftId: DRAFT_ID,
  });

  return (
    <>
      <Pressable testID="digest" onPress={() => digest()} />
      <Text testID="pending">{String(isPending)}</Text>
      <Text testID="failure">
        {failure == null ? 'none' : `${failure.cause}:${failure.isFreeOfCharge}`}
      </Text>
    </>
  );
}

async function renderDigest() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
  const di = createTestDi({
    ports: {
      httpClient,
      queryClient,
      syncStorage: createAllSeenCoachmarkStorage(ACCOUNT_ID).syncStorage,
      storage: createMemoryKeyValueStorage(),
      ...createVoiceNoteStorageFake().ports,
      logger,
    },
  });
  di.voiceNoteDraftRepository.save(ACCOUNT_ID, createSpokenVoiceNote({ draftId: DRAFT_ID }));

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <DigestProbe />
      </OverlayProvider>
    </LocalDateProvider>,
    { di },
  );

  return { httpClient, di };
}

const AGREED_CONSENT_DTO = {
  aiDataSharingDecision: 'AGREED',
  aiDataSharingAgreedAt: '2026-11-05T00:00:00.000Z',
  aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
};

const getIdempotencyKey = (
  httpClient: ReturnType<typeof createHttpClientStub>,
  callIndex: number,
) => httpClient.post.mock.calls[callIndex]?.[2]?.headers?.['Idempotency-Key'];

describe('useVoiceNoteDigest', () => {
  it('정리에 성공하면 요약과 카드 초안을 기기 초안에 담는다', async () => {
    // Given
    const { httpClient, di } = await renderDigest();
    httpClient.post.mockResolvedValue(ok(createVoiceNoteDigestDto()));

    // When
    await fireEvent.press(screen.getByTestId('digest'));

    // Then
    await waitFor(() =>
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.digest?.summary).toBe(
        '요약이에요',
      ),
    );
    expect(httpClient.post.mock.calls[0]?.[0]).toBe('v1/voice-notes/digest');
  });

  it('동의 안내에서 나중에를 누르면 동의가 필요하다고 보이고 다시 정리하면 안내를 다시 띄워 이어 간다', async () => {
    // Given
    const { httpClient, di } = await renderDigest();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1311', '동의 필요', 403)));
    // 동의를 답할 때까지 끝나지 않는 핸들러라 기다리지 않는다
    fireEvent.press(screen.getByTestId('digest')).catch(() => undefined);
    await screen.findByTestId('ai-consent-sheet');
    fireEvent.press(screen.getByTestId('ai-consent-later')).catch(() => undefined);
    await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
    expect(screen.getByTestId('failure')).toHaveTextContent('consent-required:false');
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1311', '동의 필요', 403)));
    httpClient.post.mockResolvedValueOnce(ok(createVoiceNoteDigestDto()));
    httpClient.patch.mockResolvedValue(ok(AGREED_CONSENT_DTO));

    // When
    fireEvent.press(screen.getByTestId('digest')).catch(() => undefined);
    await screen.findByTestId('ai-consent-sheet');
    fireEvent.press(screen.getByTestId('ai-consent-agree')).catch(() => undefined);

    // Then
    await waitFor(() =>
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.digest?.summary).toBe(
        '요약이에요',
      ),
    );
    expect(screen.getByTestId('failure', { includeHiddenElements: true })).toHaveTextContent(
      'none',
    );
  });

  it('기다리는 사이 초안을 지웠으면 늦은 응답이 초안을 되살리지 않는다', async () => {
    // Given
    const { httpClient, di } = await renderDigest();
    const digest = createPendingResponse(ok(createVoiceNoteDigestDto()));
    httpClient.post.mockReturnValue(digest.response);
    await act(async () => {
      fireEvent.press(screen.getByTestId('digest')).catch(jest.fn());
    });
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));

    // When
    di.voiceNoteStorageService.discard(ACCOUNT_ID, DRAFT_ID);
    await act(async () => digest.settle());

    // Then
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('false'));
    expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)).toBeNull();
  });

  it('오프라인이어도 멈추지 않고 네트워크 실패로 알리며 글자를 그대로 둔다', async () => {
    // Given
    onlineManager.setOnline(false);
    const { httpClient, di } = await renderDigest();
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    await fireEvent.press(screen.getByTestId('digest'));

    // Then
    await waitFor(() => expect(screen.getByTestId('failure')).toHaveTextContent('network:false'));
    expect(screen.getByTestId('pending')).toHaveTextContent('false');
    expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.sentences).toHaveLength(1);
    onlineManager.setOnline(true);
  });

  it('오프라인이 확실하면 서버에 보내지 않고 바로 네트워크 실패로 알린다', async () => {
    // Given
    onlineManager.setOnline(false);
    const { httpClient } = await renderDigest();

    // When
    await fireEvent.press(screen.getByTestId('digest'));

    // Then
    await waitFor(() => expect(screen.getByTestId('failure')).toHaveTextContent('network:false'));
    expect(httpClient.post).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
  });

  it('차감되지 않은 실패면 글자를 그대로 두고 그 사실을 알린다', async () => {
    // Given
    const { httpClient, di } = await renderDigest();
    httpClient.post.mockResolvedValue(
      err(new ApiError('AI_1301', '실패', 503, { charged: false })),
    );

    // When
    await fireEvent.press(screen.getByTestId('digest'));

    // Then
    await waitFor(() =>
      expect(screen.getByTestId('failure')).toHaveTextContent('ai-unavailable:true'),
    );
    expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.sentences).toHaveLength(1);
    expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.digest).toBeNull();
  });

  it('차감 여부를 서버가 말하지 않은 실패면 차감되지 않았다고 말하지 않는다', async () => {
    // Given
    const { httpClient } = await renderDigest();
    httpClient.post.mockResolvedValue(err(new ApiError('AI_1301', '실패', 503)));

    // When
    await fireEvent.press(screen.getByTestId('digest'));

    // Then
    await waitFor(() =>
      expect(screen.getByTestId('failure')).toHaveTextContent('ai-unavailable:false'),
    );
  });

  it('다시 정리는 같은 키로 보내 두 번 차감되지 않고, 키는 초안에 남아 앱을 다시 켜도 같다', async () => {
    // Given
    const { httpClient, di } = await renderDigest();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1301', '실패', 503)));
    httpClient.post.mockResolvedValueOnce(ok(createVoiceNoteDigestDto()));
    await fireEvent.press(screen.getByTestId('digest'));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('failure')).toHaveTextContent('ai-unavailable:false'),
    );
    const savedKey = di.voiceNoteDraftRepository.find(ACCOUNT_ID, DRAFT_ID)?.digestRequest
      ?.idempotencyKey;

    // When
    await fireEvent.press(screen.getByTestId('digest'));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(2));
    expect(savedKey).toBe(getIdempotencyKey(httpClient, 0));
    expect(getIdempotencyKey(httpClient, 1)).toBe(getIdempotencyKey(httpClient, 0));
  });
});
