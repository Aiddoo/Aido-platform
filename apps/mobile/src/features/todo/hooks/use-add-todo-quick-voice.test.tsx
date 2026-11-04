import '@src/shared/i18n/init';
import { AuthService } from '@src/features/auth/apis/auth.service';
import { CoachmarkService } from '@src/features/feature-discovery/apis/coachmark.service';
import { EntitlementService } from '@src/features/subscription/apis/entitlement.service';
import { UserService } from '@src/features/user/apis/user.service';
import { createRecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import { VoiceService } from '@src/features/voice/apis/voice.service';
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
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider, Text } from '@src/shared/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable } from 'react-native';

import { TodoCategoryService } from '../apis/todo-category.service';
import type { AddTodoFormValues } from '../domains/add-todo-form.schema';
import { useAddTodoQuickVoice } from './use-add-todo-quick-voice';

// AuthService가 읽는 앱 설정(ENV)은 불러올 때 expo extra를 검사해서, 기존 인증 테스트처럼 설정 모듈만 대체한다
jest.mock('@src/shared/config/env', () => ({ ENV: { API_URL: 'http://localhost:3000' } }));

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const createQuickPlanDto = (actions: unknown[], charged = true) => ({
  plan: { actions, omittedTodoCount: 0 },
  meta: {
    model: 'm',
    processingTimeMs: 1,
    tokenUsage: { input: 1, output: 1 },
    promptVersion: 'quick-plan@1',
  },
  featureQuota: null,
  charged,
});

const WORKOUT_ACTION = {
  type: 'CREATE_TODO',
  key: 'a1',
  title: '운동',
  startDate: '2026-11-09',
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
  categoryId: 1,
  duplicateOfTodoId: null,
};

function QuickVoiceProbe() {
  const methods = useForm<AddTodoFormValues>({
    defaultValues: { title: '', startDate: new Date(2026, 10, 5), repeat: null },
  });
  const quickVoice = useAddTodoQuickVoice({ methods, onExit: jest.fn() });
  const title = useWatch({ control: methods.control, name: 'title' });
  const { state } = quickVoice;

  return (
    <>
      <Pressable
        testID="begin"
        onPress={() => quickVoice.begin({ locale: 'ko-KR', contextualStrings: [] })}
      />
      <Pressable testID="finish" onPress={quickVoice.finish} />
      <Pressable testID="retry" onPress={quickVoice.retryPlanning} />
      <Pressable testID="type-instead" onPress={quickVoice.typeInstead} />
      <Text testID="status">{state.status}</Text>
      <Text testID="title">{title}</Text>
      <Text testID="plan">
        {state.status === 'review'
          ? state.plan.actions.map((action) => action.title).join(',')
          : ''}
      </Text>
    </>
  );
}

async function renderQuickVoice() {
  const httpClient = createMockHttpClient();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const speechRecognizer = createSpeechRecognizerStub();

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <QuickVoiceProbe />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        voiceService: new VoiceService(httpClient, logger),
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

  return { httpClient, speechRecognizer };
}

async function speak(speechRecognizer: ReturnType<typeof createSpeechRecognizerStub>) {
  await fireEvent.press(screen.getByTestId('begin'));
  await act(async () => speechRecognizer.emit({ type: 'start' }));
  await act(async () =>
    speechRecognizer.emit({ type: 'result', transcript: '말한 내용', isFinal: true, segments: [] }),
  );
  await fireEvent.press(screen.getByTestId('finish'));
  await act(async () => speechRecognizer.emit({ type: 'end' }));
}

const idempotencyKeyOf = (httpClient: ReturnType<typeof createMockHttpClient>, callIndex: number) =>
  httpClient.post.mock.calls[callIndex]?.[2]?.headers?.['Idempotency-Key'];

describe('useAddTodoQuickVoice', () => {
  it('말이 끝나면 글자를 계획 API로 보내고 같은 시트의 고르는 단계로 넘어간다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValue(ok(createQuickPlanDto([WORKOUT_ACTION])));

    // When
    await speak(speechRecognizer);

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(screen.getByTestId('plan')).toHaveTextContent('운동');
    expect(httpClient.post.mock.calls[0]?.[0]).toBe('v1/quick-plans');
    expect(httpClient.post.mock.calls[0]?.[1]).toEqual({ text: '말한 내용', source: 'VOICE' });
  });

  it('정리에 실패하면 들은 글자를 입력 칸에 남기고 다시 정리는 같은 키로 보낸다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1301', '실패', 503)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await fireEvent.press(screen.getByTestId('retry'));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
    expect(idempotencyKeyOf(httpClient, 1)).toBe(idempotencyKeyOf(httpClient, 0));
  });

  it('결과 없음(AI_1317) 뒤의 사용자 재시도도 추가 차감이 없도록 같은 키를 쓴다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1317', '결과 없음', 410)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await fireEvent.press(screen.getByTestId('retry'));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(idempotencyKeyOf(httpClient, 1)).toBe(idempotencyKeyOf(httpClient, 0));
  });

  it('내용이 다르다는 오류(AI_1318) 뒤에는 새 키로 보낸다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValueOnce(err(new ApiError('AI_1318', '다른 내용', 422)));
    httpClient.post.mockResolvedValueOnce(ok(createQuickPlanDto([WORKOUT_ACTION])));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));

    // When
    await fireEvent.press(screen.getByTestId('retry'));

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));
    expect(idempotencyKeyOf(httpClient, 1)).not.toBe(idempotencyKeyOf(httpClient, 0));
  });

  it('찾은 할 일이 없으면 직접 입력을 고를 때 들은 글자를 입력 칸으로 옮긴다', async () => {
    // Given
    const { httpClient, speechRecognizer } = await renderQuickVoice();
    httpClient.post.mockResolvedValue(ok(createQuickPlanDto([], false)));
    await speak(speechRecognizer);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review'));

    // When
    await fireEvent.press(screen.getByTestId('type-instead'));

    // Then
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(screen.getByTestId('title')).toHaveTextContent('말한 내용');
  });
});
