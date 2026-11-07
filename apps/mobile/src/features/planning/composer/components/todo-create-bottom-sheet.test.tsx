import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createTodoApiError } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHapticsStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryStorage,
  createMemorySyncStorage,
  createSpeechRecognizerStub,
  createTestDi,
  createVoiceNoteStorageFake,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { TodoCreateBottomSheet } from './todo-create-bottom-sheet';

let logger: ReturnType<typeof createLoggerStub>;

beforeEach(() => {
  logger = createLoggerStub();
});
const PLACEHOLDER = '무엇을 하고 싶나요?';

async function renderCreateSheet() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-10-27' });

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <TodoCreateBottomSheet onMemoChanged={jest.fn()} />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: createTestDi({
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        voiceService: new VoiceService(httpClient, logger),
        ...createVoiceNoteStorageFake().di,
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer: createSpeechRecognizerStub(),
        haptics: createHapticsStub(),
        storage: createMemoryStorage(),
      }),
    },
  );

  return { httpClient };
}

describe('TodoCreateBottomSheet 저장 실패', () => {
  it('저장이 실패해도 시트와 입력한 제목이 그대로 남아 다시 보낼 수 있다', async () => {
    // Given 연결이 없어 저장이 거절된다
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

    // When 다시 보내면 같은 제목으로 한 번 더 요청한다
    await fireEvent(screen.getByPlaceholderText(PLACEHOLDER), 'submitEditing');

    // Then
    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledTimes(2);
    });
    expect(httpClient.post.mock.calls[1]?.[1]).toMatchObject({ title: '우유 사기' });
  });
});
