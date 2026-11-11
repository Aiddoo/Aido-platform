import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createTodoApiError } from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createMemoryStorage,
  createSpeechRecognizerStub,
  createTestQueryClient,
  createVoiceNoteStorageFake,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { TodoCreateBottomSheet } from './todo-create-bottom-sheet';

const PLACEHOLDER = '무엇을 하고 싶나요?';

async function renderCreateSheet(routeParams: Record<string, string> = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-10-27', ...routeParams });
  const queryClient = createTestQueryClient();
  // 아직 AI 데이터 이용에 답하지 않은 계정
  queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), createConsent());
  const speechRecognizer = createSpeechRecognizerStub();

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <TodoCreateBottomSheet onMemoChanged={jest.fn()} />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        ...createVoiceNoteStorageFake().di,
        speechRecognizer,
        haptics: createHapticsGatewayStub(),
        storage: createMemoryStorage(),
      },
      queryClient,
    },
  );

  return { httpClient, speechRecognizer };
}

describe('TodoCreateBottomSheet 저장 실패', () => {
  it('저장이 실패해도 시트와 입력한 제목이 그대로 남아 다시 보낼 수 있다', async () => {
    // Given
    // 연결이 없어 저장이 거절된다
    const { httpClient } = await renderCreateSheet();
    httpClient.post.mockResolvedValue(err(createTodoApiError()));
    const input = await screen.findByPlaceholderText(PLACEHOLDER);
    await fireEvent.changeText(input, '우유 사기');

    // When
    await fireEvent(input, 'submitEditing');

    // Then
    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('우유 사기');

    // When
    // 다시 보내면 같은 제목으로 한 번 더 요청한다
    await fireEvent(screen.getByPlaceholderText(PLACEHOLDER), 'submitEditing');

    // Then
    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledTimes(2);
    });
    expect(httpClient.post.mock.calls[1]?.[1]).toMatchObject({ title: '우유 사기' });
  });
});

describe('TodoCreateBottomSheet 바로 말하기 요청', () => {
  it('새 기능 소개에서 말하기를 요청하고 열리면 이 시트 위에서 AI 동의를 먼저 묻는다', async () => {
    // When
    const { speechRecognizer } = await renderCreateSheet({ startVoice: '1' });

    // Then
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
  });
});
