import '@src/shared/i18n/init';
import { createParseTodoResponseDto } from '@src/features/ai/__tests__/parsed-todo.factories';
import { AiService } from '@src/features/ai/apis/ai.service';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { UserService } from '@src/features/user/apis/user.service';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
  createMockStorage,
  createMockTokenStore,
  createSpeechRecognizerStub,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable } from 'react-native';

import { TodoCategoryService } from '../apis/todo-category.service';
import type { AddTodoFormValues } from '../domains/add-todo-form.schema';
import type { TodoRepeat } from '../domains/todo-repeat.model';
import { useAddTodoQuickVoice } from './use-add-todo-quick-voice';

// AuthService가 읽는 앱 설정(ENV)은 불러올 때 expo extra를 검사해서, 기존 인증 테스트처럼 설정 모듈만 대체한다
jest.mock('@src/shared/config/env', () => ({ ENV: { API_URL: 'http://localhost:3000' } }));

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function QuickVoiceProbe() {
  const methods = useForm<AddTodoFormValues>({
    defaultValues: { title: '', startDate: new Date(2026, 10, 5), repeat: null },
  });
  const quickVoice = useAddTodoQuickVoice({ methods, onExit: jest.fn() });
  const [repeat, endDate, startDate] = useWatch({
    control: methods.control,
    name: ['repeat', 'endDate', 'startDate'],
  });

  return (
    <>
      <Pressable
        testID="begin"
        onPress={() => quickVoice.begin({ locale: 'ko-KR', contextualStrings: [] })}
      />
      <Pressable testID="finish" onPress={quickVoice.finish} />
      <Text testID="repeat">{JSON.stringify(repeat)}</Text>
      <Text testID="end-date">{endDate == null ? 'null' : toDeviceDateKey(endDate)}</Text>
      <Text testID="start-date">{toDeviceDateKey(startDate)}</Text>
    </>
  );
}

async function renderQuickVoice(parsedData: Parameters<typeof createParseTodoResponseDto>[0]) {
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  httpClient.post.mockResolvedValue(ok(createParseTodoResponseDto(parsedData)));
  const speechRecognizer = createSpeechRecognizerStub();

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <QuickVoiceProbe />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        aiService: new AiService(httpClient, logger),
        userService: new UserService(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
        authService: new AuthService(httpClient, httpClient, createMockTokenStore()),
        entitlementService: new EntitlementService(httpClient, logger),
        coachmarkService: new CoachmarkService({ isSeen: () => true, markSeen: jest.fn() }),
        recognitionLanguageRepository:
          createRecognitionLanguageRepository(createMemorySyncStorage()),
        speechRecognizer,
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsStub(),
        storage: createMockStorage(),
        logger,
      },
    },
  );

  return speechRecognizer;
}

async function speak(speechRecognizer: Awaited<ReturnType<typeof renderQuickVoice>>) {
  await fireEvent.press(screen.getByTestId('begin'));
  await act(async () => speechRecognizer.emit({ type: 'start' }));
  await act(async () =>
    speechRecognizer.emit({ type: 'result', transcript: '말한 내용', isFinal: true, segments: [] }),
  );
  await fireEvent.press(screen.getByTestId('finish'));
  await act(async () => speechRecognizer.emit({ type: 'end' }));
}

describe('useAddTodoQuickVoice', () => {
  it('매주 + 날짜 종료로 해석되면 폼 repeat에 요일과 종료일을 넣고 endDate는 비운다', async () => {
    // Given
    const speechRecognizer = await renderQuickVoice({
      data: {
        title: '운동',
        startDate: '2026-11-09',
        endDate: '2026-11-09',
        scheduledTime: null,
        isAllDay: true,
        isRecurring: true,
        recurrence: { daysOfWeek: ['WED', 'MON'], endDate: '2026-12-02' },
        categoryId: 1,
      },
    });

    // When
    await speak(speechRecognizer);

    // Then
    expect(await screen.findByTestId('repeat')).toHaveTextContent(
      JSON.stringify({
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'WED'],
        end: { type: 'UNTIL', date: '2026-12-02' },
      }),
    );
    expect(screen.getByTestId('end-date')).toHaveTextContent('null');
  });

  it('서버가 규칙을 주면 격주·끝없는 반복도 그대로 폼에 넣는다', async () => {
    // Given
    const repeat: TodoRepeat = {
      frequency: 'WEEKLY',
      interval: 2,
      weekdays: ['TUE'],
      end: { type: 'NEVER' },
    };
    const speechRecognizer = await renderQuickVoice({
      data: {
        title: '운동',
        startDate: '2026-11-10',
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        isRecurring: true,
        recurrence: { daysOfWeek: ['TUE'], endDate: '2026-12-08' },
        repeat,
        categoryId: 1,
      },
    });

    // When
    await speak(speechRecognizer);

    // Then
    expect(await screen.findByTestId('repeat')).toHaveTextContent(JSON.stringify(repeat));
  });

  it('반복이 아니면 repeat은 비우고 해석된 endDate를 그대로 넣는다', async () => {
    // Given
    const speechRecognizer = await renderQuickVoice({
      data: {
        title: '출장',
        startDate: '2026-11-09',
        endDate: '2026-11-11',
        scheduledTime: null,
        isAllDay: true,
        isRecurring: false,
        recurrence: null,
        categoryId: 1,
      },
    });

    // When
    await speak(speechRecognizer);

    // Then
    expect(await screen.findByTestId('start-date')).toHaveTextContent('2026-11-09');
    expect(screen.getByTestId('repeat')).toHaveTextContent('null');
    expect(screen.getByTestId('end-date')).toHaveTextContent('2026-11-11');
  });
});
