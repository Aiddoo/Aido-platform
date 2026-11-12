import '@src/shared/i18n/init';
import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { err, ok } from '@src/core/errors/result';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import {
  createTodoApiError,
  createTodoDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { NetworkError } from '@src/shared/errors';
import { SheetRouteScreen } from '@src/shared/ui';
import {
  createHttpClientStub,
  createMemoryKeyValueStorage,
  createPendingResponse,
  createErrorReporterStub,
  createSpeechRecognizerStub,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
} from '@src/testing/core';
import { getLastGorhomSheetProps } from '@src/testing/mocks/gorhom-bottom-sheet';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { TodoCreateBottomSheet } from './todo-create-bottom-sheet';

const PLACEHOLDER = '무엇을 하고 싶나요?';

type HostNode = ReturnType<typeof screen.getByTestId>;

function findLayoutHost(node: HostNode): HostNode | null {
  if ('onLayout' in node.props) {
    return node;
  }
  for (const child of node.children) {
    const found = typeof child === 'string' ? null : findLayoutHost(child);
    if (found != null) {
      return found;
    }
  }
  return null;
}

async function renderCreateSheet(
  routeParams: Record<string, string> = {},
  {
    hasAgreedToAi = false,
    isSheetRoute = false,
  }: { hasAgreedToAi?: boolean; isSheetRoute?: boolean } = {},
) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-10-27', ...routeParams });
  const queryClient = createTestQueryClient();
  // 기본은 아직 AI 데이터 이용에 답하지 않은 계정
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.detail(),
    hasAgreedToAi
      ? createConsent({
          aiDataSharingDecision: AI_DATA_SHARING_DECISION.AGREED,
          aiDataSharingConsentVersion: '2026-10-26',
        })
      : createConsent(),
  );
  const speechRecognizer = createSpeechRecognizerStub();
  const errorReporter = createErrorReporterStub();

  const sheet = <TodoCreateBottomSheet onMemoChanged={jest.fn()} />;
  // `todo/new` route처럼 시트를 시트 route 모달 안에 그린다. 모달은 크기를 받은 뒤 시트를 그린다
  const ui = isSheetRoute ? (
    <View testID="sheet-route">
      <SheetRouteScreen>{sheet}</SheetRouteScreen>
    </View>
  ) : (
    sheet
  );

  await renderScreen(ui, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      ports: {
        httpClient,
        queryClient,
        ...createVoiceNoteStorageFake().ports,
        speechRecognizer,
        errorReporter,
        storage: createMemoryKeyValueStorage(),
      },
    }),
  });
  const layoutHost = isSheetRoute ? findLayoutHost(screen.getByTestId('sheet-route')) : null;
  if (layoutHost != null) {
    await fireEvent(layoutHost, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }

  return { httpClient, speechRecognizer, errorReporter };
}

describe('TodoCreateBottomSheet', () => {
  describe('저장 성공', () => {
    it('저장하고 닫히는 시트 route에서 추가 토스트를 시트 안에 그리지 않고 루트에 한 번 띄운다', async () => {
      // Given
      const { httpClient } = await renderCreateSheet({}, { isSheetRoute: true });
      httpClient.post.mockResolvedValue(
        ok({
          message: 'ok',
          todo: createTodoDto({ id: 9, title: '우유 사기', startDate: '2026-10-27' }),
        }),
      );
      await fireEvent.changeText(await screen.findByPlaceholderText(PLACEHOLDER), '우유 사기');

      // When
      await fireEvent(screen.getByPlaceholderText(PLACEHOLDER), 'submitEditing');

      // Then
      expect(await screen.findAllByText('할 일을 추가했어요!')).not.toHaveLength(0);
      expect(
        within(screen.getByTestId('sheet-route')).queryAllByText('할 일을 추가했어요!'),
      ).toEqual([]);
    });
  });

  describe('저장 실패', () => {
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

  describe('저장 실패 토스트', () => {
    it('저장이 실패하면 오류 토스트를 열린 시트 위에 남기고, 끌어 내려 닫기 시작하면 그때 루트로 옮긴다', async () => {
      // Given
      const { httpClient } = await renderCreateSheet({}, { isSheetRoute: true });
      httpClient.post.mockResolvedValue(err(createTodoApiError({ message: '저장하지 못했어요' })));
      await fireEvent.changeText(await screen.findByPlaceholderText(PLACEHOLDER), '우유 사기');
      await fireEvent(screen.getByPlaceholderText(PLACEHOLDER), 'submitEditing');
      const sheetRoute = screen.getByTestId('sheet-route');
      expect(await within(sheetRoute).findAllByText('저장하지 못했어요')).not.toHaveLength(0);

      // When
      await act(async () => getLastGorhomSheetProps().onAnimate(0, -1));

      // Then
      expect(within(sheetRoute).queryAllByText('저장하지 못했어요')).toEqual([]);
      expect(screen.getAllByText('저장하지 못했어요')).not.toHaveLength(0);
    });
  });

  describe('두 번 제출', () => {
    it('저장 중에 다시 보내도 요청은 한 번이고, 보내는 날짜는 고른 날짜 key 그대로다', async () => {
      // Given
      const { httpClient } = await renderCreateSheet();
      const pending = createPendingResponse(err(createTodoApiError()));
      httpClient.post.mockReturnValue(pending.response);
      await fireEvent.changeText(await screen.findByPlaceholderText(PLACEHOLDER), '우유 사기');

      // When
      await fireEvent(screen.getByPlaceholderText(PLACEHOLDER), 'submitEditing');
      await fireEvent(screen.getByPlaceholderText(PLACEHOLDER), 'submitEditing');

      // Then
      await waitFor(() => {
        expect(httpClient.post).toHaveBeenCalledTimes(1);
      });
      expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
        title: '우유 사기',
        startDate: '2026-10-27',
      });
      pending.settle();
    });
  });

  describe('제목 한도', () => {
    it('한도를 넘는 제목을 붙여 넣으면 바로 줄이라는 안내가 보이고 저장이 꺼진다', async () => {
      // Given
      await renderCreateSheet();
      const input = await screen.findByPlaceholderText(PLACEHOLDER);

      // When
      await fireEvent.changeText(input, '가'.repeat(250));

      // Then
      expect(await screen.findByText('제목은 200자 이내로 줄여주세요')).toBeTruthy();
      expect(screen.getByTestId('todo-add-submit')).toBeDisabled();
    });
  });

  describe('바로 말하기 요청', () => {
    it('새 기능 소개에서 말하기를 요청하고 열리면 이 시트 위에서 AI 동의를 먼저 묻는다', async () => {
      // When
      const { speechRecognizer } = await renderCreateSheet({ startVoice: '1' });

      // Then
      expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
      expect(speechRecognizer.getPermission).not.toHaveBeenCalled();
    });

    it.each<{ path: string; leavePlanning: () => Promise<void> }>([
      {
        path: '정리가 실패해',
        leavePlanning: async () => {},
      },
      {
        path: '정리를 기다리다 그만둬',
        leavePlanning: async () => {
          await fireEvent.press(await screen.findByTestId('quick-voice-planning-cancel'));
        },
      },
    ])(
      '말한 뒤 $path 들은 글자가 제목 칸에 들어가면 바로 보낼 수 있다',
      async ({ path, leavePlanning }) => {
        // Given
        const { httpClient, speechRecognizer } = await renderCreateSheet(
          {},
          { hasAgreedToAi: true },
        );
        if (path === '정리가 실패해') {
          httpClient.post.mockRejectedValueOnce(new NetworkError());
        } else {
          httpClient.post.mockReturnValueOnce(new Promise(() => undefined));
        }
        await fireEvent.press(await screen.findByTestId('todo-quick-voice-button'));
        await waitFor(() => expect(speechRecognizer.start).toHaveBeenCalledTimes(1));
        await act(async () => speechRecognizer.emit({ type: 'start' }));
        await act(async () =>
          speechRecognizer.emit({
            type: 'result',
            transcript: '우유 사기',
            isFinal: true,
            segments: [],
          }),
        );

        // When
        await fireEvent.press(screen.getByTestId('quick-voice-finish'));
        await act(async () => speechRecognizer.emit({ type: 'end' }));
        await leavePlanning();

        // Then
        expect(await screen.findByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('우유 사기');
        expect(screen.getByTestId('todo-add-submit')).toBeEnabled();

        // When
        await fireEvent.press(screen.getByTestId('todo-add-submit'));

        // Then
        await waitFor(() => {
          expect(httpClient.post).toHaveBeenCalledWith(
            'v1/todos',
            expect.objectContaining({ title: '우유 사기' }),
          );
        });
      },
    );

    it('마이크 버튼으로 시작하다 기기 권한 확인이 실패하면 예상하지 못한 실패로 보고한다', async () => {
      // Given
      const { speechRecognizer, errorReporter } = await renderCreateSheet(
        {},
        { hasAgreedToAi: true },
      );
      speechRecognizer.getPermission.mockRejectedValue(new Error('native permission failed'));

      // When
      await fireEvent.press(await screen.findByTestId('todo-quick-voice-button'));

      // Then
      await waitFor(() => {
        expect(errorReporter.captureException).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'native permission failed' }),
          expect.objectContaining({ feature: 'todo' }),
        );
      });
    });
  });
});
