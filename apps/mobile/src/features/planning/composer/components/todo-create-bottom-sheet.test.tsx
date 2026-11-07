import '@src/shared/i18n/init';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createTodoApiError } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHapticsStub,
  createLoggerStub,
  createHttpClientStub,
  createMemorySyncStorage,
  createSpeechRecognizerStub,
  createStorageStub,
  createVoiceNoteStorageServiceFake,
} from '@src/shared/__tests__';
import { createTestDi } from '@src/shared/__tests__/create-test-di';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { TodoCreateBottomSheet } from './todo-create-bottom-sheet';

const logger = createLoggerStub();
const PLACEHOLDER = '무엇을 하고 싶나요?';

async function renderCreateSheet() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-10-27' });

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <TodoCreateBottomSheet />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        ...createTestDi({ httpClient }),
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        voiceService: new VoiceService(httpClient, logger),
        voiceNoteStorageService: createVoiceNoteStorageServiceFake(),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer: createSpeechRecognizerStub(),
        haptics: createHapticsStub(),
        storage: createStorageStub(),
      },
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
