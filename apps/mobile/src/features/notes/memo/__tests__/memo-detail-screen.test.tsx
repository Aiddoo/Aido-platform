import { updateMemoSchema } from '@aido/api/contracts/memo/v1';
import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { AI_DATA_SHARING_CONSENT, TODO_LIMITS } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import {
  createEntitlementSnapshot,
  createLimitApiError,
} from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { type EntitlementSnapshot } from '@src/features/billing/subscription/domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { type Consent } from '@src/features/identity/consent/domains/consent.model';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/queries/consent-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { readLocalDateState } from '@src/shared/date/clock';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { toEpochMs, toInstant } from '@src/shared/date/instant';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createSpeechRecognizerStub,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
  deliverQueryNotifications,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Suspense } from 'react';
import { KeyboardController } from 'react-native-keyboard-controller';

import MemoDetailRoute from '../../../../../app/(app)/memo/[memoId]/index';
import { MemoList } from '../components/memo-list';
import { MEMO_QUERY_KEYS } from '../queries/memo-query-keys';
import { createMemoDraftKey } from '../utils/memo-draft';
import { createMemoPlanDraftKey } from '../utils/memo-plan-draft';
import { createMemo } from './memo.fixtures';
import { ACCOUNT_ID, countEvents, createMemoDto, MEMO_ID, SAVED_MEMO_DTO } from './memo.test-utils';
import { createParseMemoResponseDto } from './parsed-memo.fixtures';

const AGREED_CONSENT_DTO = {
  aiDataSharingDecision: 'AGREED',
  aiDataSharingAgreedAt: '2026-11-05T00:00:00.000Z',
  aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
};
const PARSE_MEMO_URL = 'v1/ai/parse-memo';
const CONVERT_URL = `v1/memos/${MEMO_ID}/convert-to-todos`;
const CONSENT_REQUIRED_ERROR = createApiError(ErrorCode.AI_1311, { message: '동의 필요' });
const REJECTED_ERROR = createApiError(ErrorCode.MEMO_2004, {
  message: '거절',
  status: HttpStatus.BAD_REQUEST,
});
/** 처음 메모의 서버 수정 시각 */
const MEMO_UPDATED_AT = '2026-11-06T00:00:00.000Z';
const DRAFT_KEY = createMemoDraftKey({ userId: ACCOUNT_ID, memoId: MEMO_ID });
const PLAN_DRAFT_KEY = createMemoPlanDraftKey({
  userId: ACCOUNT_ID,
  memoId: MEMO_ID,
  timezone: 'Asia/Seoul',
});

function createAgreedConsent() {
  return createConsent({
    aiDataSharingDecision: 'AGREED',
    aiDataSharingAgreedAt: toInstant(AGREED_CONSENT_DTO.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
  });
}

/** 서버는 받은 글을 저장하고 수정 시각을 1분 늦춘 메모를 돌려준다 */
function echoSavedMemo(httpClient: ReturnType<typeof createHttpClientStub>) {
  httpClient.patch.mockImplementation(async (_url, body) =>
    ok({ message: 'updated', memo: { ...SAVED_MEMO_DTO, ...updateMemoSchema.parse(body) } }),
  );
}

/** 누른 동작이 다이얼로그·응답을 기다리는 동안 끝나지 않아 기다리지 않는다 */
async function startPress(element: ReturnType<typeof screen.getByText>) {
  await act(async () => {
    fireEvent.press(element).catch(noop);
  });
}

function getParseRequests(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.post.mock.calls.filter(([url]) => url === PARSE_MEMO_URL);
}

interface RenderMemoDetailOptions {
  consent?: Consent;
  entitlements?: EntitlementSnapshot;
  /** 앱을 다시 열기 전에 남긴 고치던 글자와 그때 원본의 수정 시각 */
  draft?: { content: string; sourceUpdatedAt?: string };
  /** 상세 조회가 실패한다 */
  detailError?: ReturnType<typeof createApiError>;
  withList?: boolean;
}

async function renderMemoDetail({
  consent,
  entitlements,
  draft,
  detailError,
  withList = false,
}: RenderMemoDetailOptions = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ memoId: String(MEMO_ID) });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  if (consent != null) {
    queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), consent);
  }
  if (entitlements != null) {
    queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), entitlements);
  }
  if (detailError == null) {
    queryClient.setQueryData(
      MEMO_QUERY_KEYS.detail({ memoId: MEMO_ID }),
      createMemo({ id: MEMO_ID, content: '처음 메모' }),
    );
  }
  queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
    pages: [{ items: [createMemo({ id: MEMO_ID, content: '처음 메모' })], nextCursor: null }],
    pageParams: [undefined],
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation((url) => {
    if (url === `v1/memos/${MEMO_ID}`) {
      return Promise.resolve(
        detailError == null ? ok({ memo: createMemoDto() }) : fail(detailError),
      );
    }
    if (url === 'v1/todo-categories') {
      return Promise.resolve(ok(createTodoCategoryListDto()));
    }

    return new Promise(() => undefined);
  });
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  const di = createTestDi({
    ports: {
      httpClient,
      queryClient,
      analytics,
      haptics,
      speechRecognizer: createSpeechRecognizerStub(),
      ...createVoiceNoteStorageFake().ports,
    },
  });
  if (draft != null) {
    di.draftService.save(
      DRAFT_KEY,
      { content: draft.content },
      { sourceUpdatedAt: toEpochMs(toInstant(draft.sourceUpdatedAt ?? MEMO_UPDATED_AT)) },
    );
  }

  await renderScreen(
    <>
      {/* 상세 아래에 깔린 메모 탭의 목록. 돌아가면 보이는 카드를 본다 */}
      {withList && (
        <Suspense fallback={null}>
          <MemoList />
        </Suspense>
      )}
      <MemoDetailRoute />
    </>,
    { withLocalDate: true, withOverlay: true, di },
  );

  return { httpClient, queryClient, analytics, haptics, di };
}

/** 카테고리를 받아야 메뉴의 AI 정리·할 일로 바꾸기가 켜진다 */
async function waitForCategories(httpClient: ReturnType<typeof createHttpClientStub>) {
  await waitFor(() =>
    expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories', expect.anything()),
  );
  await act(async () => {});
}

async function editContent(content: string) {
  const input = await screen.findByTestId('memo-editor-input');
  await act(async () => {
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, content);
  });
}

async function pressToolbar(label: '저장' | '뒤로 가기' | '메모 고정' | '메모 고정 해제') {
  await act(async () => {
    await fireEvent.press(await screen.findByLabelText(label));
  });
}

async function pressMenu(text: '할 일로 바꾸기' | '삭제') {
  await startPress(await screen.findByRole('menuitem', { name: text }));
}

describe('MemoDetailRoute', () => {
  describe('글 고치기', () => {
    it('저장 버튼은 입력칸에 들어간 뒤에 나타나고, 앞뒤 공백을 뺀 글로 한 번 보내 편집을 끝낸다', async () => {
      // Given
      const { httpClient, analytics } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      expect(screen.queryByLabelText('저장')).toBeNull();

      // When
      await editContent('  고친 메모  ');
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '고친 메모',
      });
      expect(screen.getByDisplayValue('고친 메모', { normalizer: (text) => text })).toBeTruthy();
      expect(countEvents(analytics, 'memo_updated')).toBe(1);
      expect(router.back).not.toHaveBeenCalled();
    });

    it('공백만 더하고 저장하면 요청 없이 편집을 끝낸다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();

      // When
      await editContent('처음 메모  ');
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(httpClient.patch).not.toHaveBeenCalled();
    });

    it('공백만 남기면 저장 버튼이 꺼지고 뒤로 가기는 요청 없이 떠난다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      await editContent('   ');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      expect(screen.getByLabelText('저장')).toBeDisabled();
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).not.toHaveBeenCalled();
    });

    it('글자 수 한도를 넘기면 저장 버튼이 꺼지고 뒤로 가기는 보내지 않고 떠난다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      await editContent('가'.repeat(5_001));

      // When
      await pressToolbar('뒤로 가기');

      // Then
      expect(screen.getByLabelText('저장')).toBeDisabled();
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).not.toHaveBeenCalled();
    });

    it('고친 글이 있으면 뒤로 갈 때 저장한 뒤 떠나고 목록에도 새 글이 보이게 한다', async () => {
      // Given
      const { httpClient, queryClient, analytics } = await renderMemoDetail({ withList: true });
      echoSavedMemo(httpClient);
      expect(await screen.findByText('처음 메모')).toBeTruthy();
      await editContent('고친 메모');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '고친 메모',
      });
      expect(queryClient.getQueryData(MEMO_QUERY_KEYS.list())?.pages[0]?.items[0]?.content).toBe(
        '고친 메모',
      );
      // 목록을 다시 받기 전에도 카드가 새 글을 보인다
      expect(await screen.findByText('고친 메모')).toBeTruthy();
      expect(screen.queryByText('처음 메모')).toBeNull();
      expect(countEvents(analytics, 'memo_updated')).toBe(1);
    });

    it('고친 글이 없으면 저장 요청 없이 떠난다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      await screen.findByDisplayValue('처음 메모');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).not.toHaveBeenCalled();
    });

    it('서버가 거절하면 한 번 알리고 글을 둔 채 화면에 남는다', async () => {
      // Given
      const { httpClient, haptics, analytics } = await renderMemoDetail();
      httpClient.patch.mockResolvedValue(fail(REJECTED_ERROR));
      await editContent('고친 메모');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(haptics.notify).toHaveBeenCalledWith('error'));
      expect(haptics.notify).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(router.back).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
      expect(countEvents(analytics, 'memo_updated')).toBe(0);
    });

    it('연결 문제로 못 보내면 뒤로 가기는 떠나고 글은 초안에 남는다', async () => {
      // Given
      const { httpClient, di } = await renderMemoDetail();
      httpClient.patch.mockRejectedValue(new NetworkError());
      await editContent('고친 메모');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(di.draftService.restore(DRAFT_KEY)).toMatchObject({
          status: 'restored',
          value: { content: '고친 메모' },
        }),
      );
    });

    it.each([
      {
        scenario: '고치지 않은 입력은 다시 받은 글을 보인다',
        draft: undefined,
        edited: null,
        expected: '다른 기기에서 고친 메모',
      },
      {
        scenario: '고치던 입력은 덮지 않는다',
        draft: undefined,
        edited: '쓰던 글',
        expected: '쓰던 글',
      },
      {
        scenario: '복원한 초안은 덮지 않는다',
        draft: '앱을 닫기 전 글',
        edited: null,
        expected: '앱을 닫기 전 글',
      },
    ])('다시 받은 메모가 바뀌면 $scenario', async ({ draft, edited, expected }) => {
      // Given
      const { queryClient } = await renderMemoDetail({
        draft: draft == null ? undefined : { content: draft },
      });
      await screen.findByDisplayValue(draft ?? '처음 메모');
      if (edited != null) {
        await editContent(edited);
      }

      // When
      await act(async () => {
        queryClient.setQueryData(
          MEMO_QUERY_KEYS.detail({ memoId: MEMO_ID }),
          createMemo({ id: MEMO_ID, content: '다른 기기에서 고친 메모' }),
        );
      });

      // Then
      expect(await screen.findByDisplayValue(expected)).toBeTruthy();
    });

    it.each([
      { scenario: '고치던 글자', draft: undefined, edited: '쓰던 글', expected: '쓰던 글' },
      {
        scenario: '복원한 초안',
        draft: '앱을 닫기 전 글',
        edited: null,
        expected: '앱을 닫기 전 글',
      },
    ])(
      '$scenario는 고치는 사이 서버 글이 바뀌어도 뒤로 갈 때 저장한다',
      async ({ draft, edited, expected }) => {
        // Given
        const { httpClient, queryClient } = await renderMemoDetail({
          draft: draft == null ? undefined : { content: draft },
        });
        echoSavedMemo(httpClient);
        await screen.findByDisplayValue(draft ?? '처음 메모');
        if (edited != null) {
          await editContent(edited);
        }
        await act(async () => {
          queryClient.setQueryData(
            MEMO_QUERY_KEYS.detail({ memoId: MEMO_ID }),
            createMemo({ id: MEMO_ID, content: '다른 기기에서 고친 메모' }),
          );
          await deliverQueryNotifications();
        });

        // When
        await pressToolbar('뒤로 가기');

        // Then
        await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
        expect(httpClient.patch).toHaveBeenCalledTimes(1);
        expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
          content: expected,
        });
      },
    );
  });

  describe('초안', () => {
    it('앞뒤 공백을 다듬어 저장된 글을 뒤로 가기로 저장하면 공백만 다른 초안을 남기지 않는다', async () => {
      // Given
      const { httpClient, di } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모  ');

      // When
      await pressToolbar('뒤로 가기');
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      await act(deliverQueryNotifications);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '고친 메모',
      });
      await screen.unmount();
      expect(
        di.draftService.restore(DRAFT_KEY, {
          sourceUpdatedAt: toEpochMs(toInstant(SAVED_MEMO_DTO.updatedAt)),
        }).status,
      ).not.toBe('restored');
    });

    it('글 끝에 공백만 더하고 뒤로 가면 요청 없이 떠나고 초안을 남기지 않는다', async () => {
      // Given
      const { httpClient, di } = await renderMemoDetail();
      await editContent('처음 메모  ');
      await waitFor(() => expect(di.draftService.restore(DRAFT_KEY).status).toBe('restored'));

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).not.toHaveBeenCalled();
      // 떠나는 순간 지운다. 화면이 내려가며 하는 저장을 기다리면 그 사이 앱이 끝날 때 초안이 남는다
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
      await screen.unmount();
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    });

    it('저장하지 않은 초안이 있으면 그 글로 열고 바로 저장할 수 있다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail({ draft: { content: '앱을 닫기 전 글' } });
      echoSavedMemo(httpClient);

      // When
      await screen.findByDisplayValue('앱을 닫기 전 글');

      // Then
      expect(screen.getByLabelText('저장')).toBeEnabled();
    });

    it('복원한 초안은 열자마자 뒤로 가도 저장하고 초안을 지운다', async () => {
      // Given
      const { httpClient, di } = await renderMemoDetail({ draft: { content: '앱을 닫기 전 글' } });
      echoSavedMemo(httpClient);
      await screen.findByDisplayValue('앱을 닫기 전 글');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '앱을 닫기 전 글',
      });
      await screen.unmount();
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    });

    it('저장 버튼으로 저장하면 초안을 지운다', async () => {
      // Given
      const { httpClient, di } = await renderMemoDetail({ draft: { content: '앱을 닫기 전 글' } });
      echoSavedMemo(httpClient);
      await screen.findByDisplayValue('앱을 닫기 전 글');

      // When
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      await screen.unmount();
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    });

    it('저장이 거절되면 초안을 남긴다', async () => {
      // Given
      const { httpClient, di } = await renderMemoDetail({ draft: { content: '앱을 닫기 전 글' } });
      httpClient.patch.mockResolvedValue(fail(REJECTED_ERROR));
      await screen.findByDisplayValue('앱을 닫기 전 글');

      // When
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      await screen.unmount();
      expect(di.draftService.restore(DRAFT_KEY)).toMatchObject({
        status: 'restored',
        value: { content: '앱을 닫기 전 글' },
      });
    });

    it('원본이 초안보다 나중에 바뀌었으면 초안을 버리고 알린 뒤 서버 글로 연다', async () => {
      // When
      const { di } = await renderMemoDetail({
        draft: { content: '오래된 초안', sourceUpdatedAt: '2026-11-05T00:00:00.000Z' },
      });

      // Then
      expect(await screen.findByDisplayValue('처음 메모')).toBeTruthy();
      expect(
        await screen.findAllByText('메모가 다른 곳에서 수정되어 저장하지 않은 내용은 삭제했어요'),
      ).toHaveLength(1);
      expect(screen.queryByLabelText('저장')).toBeNull();
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    });
  });

  describe('저장 버튼과 뒤로 가기의 차이', () => {
    let dismissKeyboard: jest.SpyInstance;

    beforeEach(() => {
      dismissKeyboard = jest.spyOn(KeyboardController, 'dismiss');
    });

    afterEach(() => {
      dismissKeyboard.mockRestore();
    });

    it('저장 버튼은 화면에 남은 채 키보드를 내리고 편집을 끝낸다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모');

      // When
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(dismissKeyboard).toHaveBeenCalledTimes(1);
      expect(router.back).not.toHaveBeenCalled();
    });

    it('저장 버튼으로 저장한 뒤에는 바뀐 글이 없어 뒤로 가기가 다시 보내지 않는다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모');
      await pressToolbar('저장');
      await waitFor(() => expect(dismissKeyboard).toHaveBeenCalledTimes(1));

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });

    it('저장 버튼이 거절되면 글과 편집 상태를 그대로 두고 키보드도 내리지 않는다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      httpClient.patch.mockResolvedValue(fail(REJECTED_ERROR));
      await editContent('고친 메모');

      // When
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('저장')).toBeTruthy();
      expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
      expect(dismissKeyboard).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('저장 버튼은 연결 문제여도 떠나지 않고 편집을 이어 가게 한다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      httpClient.patch.mockRejectedValue(new NetworkError());
      await editContent('고친 메모');

      // When
      await pressToolbar('저장');

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('저장')).toBeTruthy();
      expect(dismissKeyboard).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('뒤로 가기로 저장하면 키보드를 직접 내리지 않고 떠난다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모');

      // When
      await pressToolbar('뒤로 가기');

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(dismissKeyboard).not.toHaveBeenCalled();
    });

    it('저장하는 동안에는 저장과 뒤로 가기를 다시 누를 수 없다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      const pending = createPendingResponse(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      httpClient.patch.mockReturnValue(pending.response);
      await editContent('고친 메모');

      // When
      await startPress(screen.getByLabelText('저장'));

      // Then
      expect(screen.getByLabelText('저장')).toBeDisabled();
      expect(screen.getByLabelText('뒤로 가기')).toBeDisabled();
      await act(async () => {
        pending.settle();
      });
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });
  });

  describe('연타', () => {
    it('저장 버튼을 같은 프레임에 두 번 눌러도 한 번만 보낸다', async () => {
      // Given
      const { httpClient, analytics } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모');
      const save = await screen.findByLabelText('저장');

      // When
      await act(async () => {
        await Promise.all([fireEvent.press(save), fireEvent.press(save)]);
      });

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(countEvents(analytics, 'memo_updated')).toBe(1);
    });

    it('뒤로 가기를 같은 프레임에 두 번 눌러도 한 번 보내고 한 번 떠난다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모');
      const back = await screen.findByLabelText('뒤로 가기');

      // When
      await act(async () => {
        await Promise.all([fireEvent.press(back), fireEvent.press(back)]);
      });

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });
  });

  describe('저장 뒤 떠나는 동안', () => {
    it('저장을 기다리는 사이 밀어서 떠났으면 저장이 끝나도 이전 화면을 한 번 더 닫지 않는다', async () => {
      // Given
      const navigation = {
        isFocused: jest.fn(() => true),
        getParent: () => undefined,
        addListener: () => () => undefined,
      };
      jest.mocked(useNavigation).mockReturnValue(navigation);
      const { httpClient } = await renderMemoDetail();
      const pending = createPendingResponse(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      httpClient.patch.mockReturnValue(pending.response);
      await editContent('고친 메모');
      await startPress(screen.getByLabelText('뒤로 가기'));
      navigation.isFocused.mockReturnValue(false);

      // When
      await act(async () => {
        pending.settle();
      });
      await act(deliverQueryNotifications);

      // Then
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(router.back).not.toHaveBeenCalled();
    });
  });

  describe('다시 그리기', () => {
    // 편집기 맨 위·도구 막대·진행 표시가 메모 id를 route에서 읽어, 그 호출 수가 셋이 그려진 횟수다
    function countEditorRenders() {
      return jest.mocked(useLocalSearchParams).mock.calls.length;
    }

    it('글자를 칠 때 편집기 맨 위와 도구 막대는 다시 그려지지 않고 입력칸만 바뀐다', async () => {
      // Given
      await renderMemoDetail();
      // 처음 고친 글자는 저장 버튼을 켜 도구 막대가 한 번 그려진다. 그 뒤부터 센다
      await editContent('처음 메모 고침');
      await act(deliverQueryNotifications);
      const renderCountBeforeTyping = countEditorRenders();
      const input = screen.getByTestId('memo-editor-input');

      // When
      await fireEvent.changeText(input, '처음 메모 고침 하나');
      await fireEvent.changeText(input, '처음 메모 고침 하나 둘');
      await fireEvent.changeText(input, '처음 메모 고침 하나 둘 셋');

      // Then
      expect(input).toHaveDisplayValue('처음 메모 고침 하나 둘 셋');
      expect(countEditorRenders()).toBe(renderCountBeforeTyping);
    });
  });

  describe('고정', () => {
    it('고정을 누르면 고정을 보내고 한 번 남긴다', async () => {
      // Given
      const { httpClient, analytics } = await renderMemoDetail();
      httpClient.patch.mockResolvedValue(
        ok({
          message: 'updated',
          memo: { ...SAVED_MEMO_DTO, content: '처음 메모', isPinned: true },
        }),
      );
      await screen.findByDisplayValue('처음 메모');

      // When
      await pressToolbar('메모 고정');

      // Then
      expect(await screen.findByLabelText('메모 고정 해제')).toBeTruthy();
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}/pin`, { isPinned: true });
      expect(countEvents(analytics, 'memo_pin_toggled')).toBe(1);
    });
  });

  describe('삭제', () => {
    async function confirmDelete() {
      await pressMenu('삭제');
      await screen.findByText('메모를 삭제할까요?');
      await act(async () => {
        await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
      });
    }

    it('확인하면 지우고 목록에서 빼고 초안을 버린 뒤 떠난다', async () => {
      // Given
      const { httpClient, queryClient, analytics, di } = await renderMemoDetail({
        draft: { content: '앱을 닫기 전 글' },
      });
      httpClient.delete.mockResolvedValue(ok({ message: 'deleted' }));
      await screen.findByDisplayValue('앱을 닫기 전 글');

      // When
      await confirmDelete();

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.delete).toHaveBeenCalledTimes(1);
      expect(httpClient.delete).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`);
      expect(queryClient.getQueryState(MEMO_QUERY_KEYS.list())?.isInvalidated).toBe(true);
      expect(countEvents(analytics, 'memo_deleted')).toBe(1);
      expect(httpClient.patch).not.toHaveBeenCalled();
      await screen.unmount();
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    });

    it('지우지 못하면 다이얼로그와 목록의 메모를 남기고 떠나지 않는다', async () => {
      // Given
      const { httpClient, queryClient, haptics, analytics } = await renderMemoDetail();
      httpClient.delete.mockRejectedValue(new ServerError(500));
      await screen.findByDisplayValue('처음 메모');

      // When
      await confirmDelete();

      // Then
      await waitFor(() => expect(haptics.notify).toHaveBeenCalledWith('error'));
      expect(screen.getByText('메모를 삭제할까요?')).toBeTruthy();
      expect(
        queryClient.getQueryData(MEMO_QUERY_KEYS.list())?.pages[0]?.items.map(({ id }) => id),
      ).toEqual([MEMO_ID]);
      expect(router.back).not.toHaveBeenCalled();
      expect(countEvents(analytics, 'memo_deleted')).toBe(0);
    });

    it('취소하면 보내지 않고 남는다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      await screen.findByDisplayValue('처음 메모');
      await pressMenu('삭제');

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByRole('button', { name: '취소' }));
      });

      // Then
      await waitFor(() => expect(screen.queryByText('메모를 삭제할까요?')).toBeNull());
      expect(httpClient.delete).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });
  });

  describe('없는 메모', () => {
    it('지워졌거나 볼 수 없는 메모는 안내와 돌아가기를 보인다', async () => {
      // Given
      await renderMemoDetail({
        detailError: createApiError(ErrorCode.MEMO_2001, {
          message: '메모 없음',
          status: HttpStatus.NOT_FOUND,
        }),
      });
      expect(await screen.findByText('지금은 볼 수 없는 메모예요')).toBeTruthy();

      // When
      await act(async () => {
        await fireEvent.press(screen.getByText('뒤로 가기'));
      });

      // Then
      expect(router.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('할 일로 바꾸기', () => {
    it('고친 글이 있으면 먼저 저장한 뒤 그 글로 시트를 연다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      echoSavedMemo(httpClient);
      await editContent('고친 메모');
      await waitForCategories(httpClient);

      // When
      await pressMenu('할 일로 바꾸기');

      // Then
      await waitFor(() =>
        expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
          content: '고친 메모',
        }),
      );
      const sheet = await screen.findByTestId('memo-convert-sheet');
      expect(within(sheet).getByDisplayValue('고친 메모')).toBeTruthy();
    });

    it('먼저 하는 저장에 실패하면 시트를 열지 않는다', async () => {
      // Given
      const { httpClient } = await renderMemoDetail();
      httpClient.patch.mockResolvedValue(fail(REJECTED_ERROR));
      await editContent('고친 메모');
      await waitForCategories(httpClient);

      // When
      await pressMenu('할 일로 바꾸기');

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('memo-convert-sheet')).toBeNull();
    });

    it('이미 없는 메모라 거절되면 시트를 닫고 초안을 버린 뒤 메모를 떠난다', async () => {
      // Given
      // 서버 글과 같은 초안은 고친 글이 아니라 먼저 저장하지 않고 남아 있다
      const { httpClient, di } = await renderMemoDetail({ draft: { content: '처음 메모' } });
      httpClient.post.mockResolvedValue(
        fail(createApiError(ErrorCode.MEMO_2001, { message: '메모 없음' })),
      );
      await waitForCategories(httpClient);
      await pressMenu('할 일로 바꾸기');
      const sheet = await screen.findByTestId('memo-convert-sheet');

      // When
      await act(async () => {
        await fireEvent.press(within(sheet).getByLabelText('저장하기'));
      });

      // Then
      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(CONVERT_URL, expect.anything());
      expect(httpClient.patch).not.toHaveBeenCalled();
      await screen.unmount();
      expect(di.draftService.restore(DRAFT_KEY).status).not.toBe('restored');
    });

    describe('시트에서 고르기', () => {
      async function openConvertSheet() {
        const rendered = await renderMemoDetail();
        rendered.httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
        await waitForCategories(rendered.httpClient);
        await pressMenu('할 일로 바꾸기');
        const sheet = await screen.findByTestId('memo-convert-sheet');
        await within(sheet).findByText('기본');

        return { ...rendered, sheet };
      }

      it('메모 글을 제목으로 오늘의 종일 할 일을 보내고 시트를 닫은 뒤 피드로 간다', async () => {
        // Given
        const { httpClient, analytics, sheet } = await openConvertSheet();
        const today = readLocalDateState().currentLocalDateKey;

        // When
        await act(async () => {
          await fireEvent.press(within(sheet).getByLabelText('저장하기'));
        });

        // Then
        await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/feed'));
        expect(httpClient.post).toHaveBeenCalledTimes(1);
        expect(httpClient.post).toHaveBeenCalledWith(CONVERT_URL, {
          todos: [
            {
              title: '처음 메모',
              categoryId: 1,
              startDate: today,
              isAllDay: true,
              isRecurring: false,
              visibility: 'PUBLIC',
            },
          ],
        });
        expect(countEvents(analytics, 'memo_converted_to_todo')).toBe(1);
        expect(router.back).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByTestId('memo-convert-sheet')).toBeNull());
      });

      it('날짜·카테고리를 칩으로 고르면 그 값으로 보낸다', async () => {
        // Given
        const { httpClient, sheet } = await openConvertSheet();
        const tomorrow = addDaysToDateKey(readLocalDateState().currentLocalDateKey, 1);

        // When
        await userEvent.press(within(sheet).getByRole('button', { name: '오늘' }));
        await userEvent.press(await screen.findByText('내일'));
        await userEvent.press(within(sheet).getByRole('button', { name: '기본' }));
        await fireEvent.press(await screen.findByTestId('category-select-option-2'));
        await fireEvent.press(screen.getByTestId('category-select-submit'));
        await act(async () => {
          await fireEvent.press(within(sheet).getByLabelText('저장하기'));
        });

        // Then
        await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
        expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
          todos: [{ title: '처음 메모', categoryId: 2, startDate: tomorrow, isAllDay: true }],
        });
      });

      it('제목을 비우면 저장 버튼이 꺼지고 보내지 않는다', async () => {
        // Given
        const { httpClient, sheet } = await openConvertSheet();

        // When
        await fireEvent.changeText(within(sheet).getByDisplayValue('처음 메모'), '   ');
        await act(async () => {
          await fireEvent.press(within(sheet).getByLabelText('저장하기'));
        });

        // Then
        expect(within(sheet).getByLabelText('저장하기')).toBeDisabled();
        expect(httpClient.post).not.toHaveBeenCalled();
      });

      it('제목 입력칸은 할 일 제목 한도까지만 받는다', async () => {
        // When
        const { sheet } = await openConvertSheet();

        // Then
        expect(within(sheet).getByDisplayValue('처음 메모')).toHaveProp(
          'maxLength',
          TODO_LIMITS.TITLE_MAX_LENGTH,
        );
      });
    });
  });

  describe('AI로 할 일 나누기', () => {
    async function renderForAiParse({
      consent,
      entitlements = createEntitlementSnapshot(),
    }: {
      consent: Consent;
      entitlements?: EntitlementSnapshot;
    }) {
      const rendered = await renderMemoDetail({ consent, entitlements });
      await screen.findByDisplayValue('처음 메모');
      await waitForCategories(rendered.httpClient);

      return rendered;
    }

    async function startAiParse() {
      // 동의를 답할 때까지 끝나지 않는 핸들러라 기다리지 않는다
      fireEvent.press(await screen.findByText('AI로 할 일 나누기')).catch(() => undefined);
    }

    it('정리하는 동안 진행을 알리고 끝나면 결과를 보는 화면으로 간다', async () => {
      // Given
      const { httpClient, analytics } = await renderForAiParse({ consent: createAgreedConsent() });
      const pendingParse = createPendingResponse(ok(createParseMemoResponseDto()));
      httpClient.post.mockReturnValue(pendingParse.response);

      // When
      await startAiParse();

      // Then
      expect(await screen.findAllByText('할 일로 나누는 중이에요')).not.toHaveLength(0);
      expect(router.push).not.toHaveBeenCalled();
      await act(async () => {
        pendingParse.settle();
      });
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/memo/[memoId]/ai-review',
          params: { memoId: MEMO_ID },
        }),
      );
      expect(getParseRequests(httpClient)).toHaveLength(1);
      expect(getParseRequests(httpClient)[0]?.[1]).toEqual({ content: '처음 메모', categoryId: 1 });
      expect(countEvents(analytics, 'ai_parse_used')).toBe(1);
      expect(countEvents(analytics, 'voice_plan_generated')).toBe(1);
    });

    it('고친 글이 있으면 먼저 저장한 뒤 저장한 글로 정리한다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createAgreedConsent() });
      echoSavedMemo(httpClient);
      httpClient.post.mockResolvedValue(ok(createParseMemoResponseDto()));
      await editContent('고친 메모');

      // When
      await startAiParse();

      // Then
      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(getParseRequests(httpClient)[0]?.[1]).toEqual({ content: '고친 메모', categoryId: 1 });
    });

    it('정리에 실패하면 한 번 알리고 실패를 한 번 남기며 결과 화면으로 가지 않는다', async () => {
      // Given
      const { httpClient, analytics, haptics } = await renderForAiParse({
        consent: createAgreedConsent(),
      });
      httpClient.post.mockRejectedValue(new ServerError(500));

      // When
      await startAiParse();

      // Then
      await waitFor(() => expect(haptics.notify).toHaveBeenCalledWith('error'));
      expect(haptics.notify).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
      expect(countEvents(analytics, 'ai_parse_used')).toBe(1);
      expect(countEvents(analytics, 'voice_plan_failed')).toBe(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_plan_failed', {
        source: 'memo',
        cause: expect.any(String),
      });
    });

    it('정리하다 서버가 한도로 거절하면 한도 안내를 띄우고 햅틱을 한 번 낸다', async () => {
      // Given
      const { httpClient, haptics } = await renderForAiParse({ consent: createAgreedConsent() });
      httpClient.post.mockResolvedValue(fail(createLimitApiError(ErrorCode.AI_1303)));

      // When
      await startAiParse();

      // Then
      expect(await screen.findByText('이번 달 AI 할 일 만들기를 다 썼어요')).toBeTruthy();
      await waitFor(() => expect(haptics.notify).toHaveBeenCalledWith('error'));
      expect(haptics.notify).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
    });

    it('이번 달 한도를 다 썼으면 안내를 띄우고 정리를 요청하지 않는다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({
        consent: createAgreedConsent(),
        entitlements: createEntitlementSnapshot({ used: { AI_PARSE: 10 } }),
      });

      // When
      await startAiParse();

      // Then
      expect(await screen.findByText('이번 달 AI 할 일 만들기를 다 썼어요')).toBeTruthy();
      expect(getParseRequests(httpClient)).toHaveLength(0);
    });

    it('정리를 기다리는 사이 편집기를 떠나면 결과 화면으로 끌고 가지 않고 결과는 초안에 남긴다', async () => {
      // Given
      const { httpClient, di } = await renderForAiParse({ consent: createAgreedConsent() });
      const pendingParse = createPendingResponse(ok(createParseMemoResponseDto()));
      httpClient.post.mockReturnValue(pendingParse.response);
      await startAiParse();
      await waitFor(() => expect(getParseRequests(httpClient)).toHaveLength(1));
      await screen.unmount();

      // When
      await act(async () => {
        pendingParse.settle();
      });

      // Then
      await waitFor(() => expect(di.draftService.restore(PLAN_DRAFT_KEY).status).toBe('restored'));
      expect(router.push).not.toHaveBeenCalled();
    });

    it('정리를 기다리는 사이 탭을 바꿔 편집기가 가려지면 끌고 가지 않고 돌아와 누르면 차감 없이 연다', async () => {
      // Given
      const navigation = {
        isFocused: jest.fn(() => true),
        getParent: () => undefined,
        addListener: () => () => undefined,
      };
      jest.mocked(useNavigation).mockReturnValue(navigation);
      const { httpClient } = await renderForAiParse({ consent: createAgreedConsent() });
      const pendingParse = createPendingResponse(ok(createParseMemoResponseDto()));
      httpClient.post.mockReturnValue(pendingParse.response);
      await startAiParse();
      await waitFor(() => expect(getParseRequests(httpClient)).toHaveLength(1));
      navigation.isFocused.mockReturnValue(false);

      // When
      await act(async () => {
        pendingParse.settle();
      });
      await act(deliverQueryNotifications);

      // Then
      expect(screen.getByDisplayValue('처음 메모')).toBeOnTheScreen();
      expect(router.push).not.toHaveBeenCalled();

      // When
      navigation.isFocused.mockReturnValue(true);
      await startAiParse();

      // Then
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/memo/[memoId]/ai-review',
          params: { memoId: MEMO_ID },
        }),
      );
      expect(getParseRequests(httpClient)).toHaveLength(1);
    });

    it('동의 안내에서 나중에를 누르면 정리를 요청하지 않는다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createConsent() });
      await startAiParse();
      await screen.findByTestId('ai-consent-sheet');

      // When
      fireEvent.press(screen.getByTestId('ai-consent-later')).catch(() => undefined);

      // Then
      await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
      expect(getParseRequests(httpClient)).toHaveLength(0);
      expect(router.push).not.toHaveBeenCalled();
    });

    it('동의하면 정리를 한 번 요청하고 결과를 보는 화면으로 간다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createConsent() });
      httpClient.patch.mockResolvedValue(ok(AGREED_CONSENT_DTO));
      httpClient.post.mockResolvedValue(ok(createParseMemoResponseDto()));
      await startAiParse();
      await screen.findByTestId('ai-consent-sheet');

      // When
      fireEvent.press(screen.getByTestId('ai-consent-agree')).catch(() => undefined);

      // Then
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/memo/[memoId]/ai-review',
          params: { memoId: MEMO_ID },
        }),
      );
      expect(getParseRequests(httpClient)).toHaveLength(1);
    });

    it('정리하는 사이 동의가 사라졌으면 동의를 물은 뒤 한 번만 다시 요청한다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createAgreedConsent() });
      httpClient.patch.mockResolvedValue(ok(AGREED_CONSENT_DTO));
      httpClient.post
        .mockResolvedValueOnce(fail(CONSENT_REQUIRED_ERROR))
        .mockResolvedValueOnce(ok(createParseMemoResponseDto()));
      await startAiParse();
      await screen.findByTestId('ai-consent-sheet');

      // When
      fireEvent.press(screen.getByTestId('ai-consent-agree')).catch(() => undefined);

      // Then
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/memo/[memoId]/ai-review',
          params: { memoId: MEMO_ID },
        }),
      );
      expect(getParseRequests(httpClient)).toHaveLength(2);
    });

    it('동의한 뒤에도 서버가 동의 없음으로 거절하면 다시 묻지 않고 이유만 알린다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createAgreedConsent() });
      httpClient.patch.mockResolvedValue(ok(AGREED_CONSENT_DTO));
      httpClient.post.mockResolvedValue(fail(CONSENT_REQUIRED_ERROR));
      await startAiParse();
      await screen.findByTestId('ai-consent-sheet');

      // When
      fireEvent.press(screen.getByTestId('ai-consent-agree')).catch(() => undefined);

      // Then
      expect(
        await screen.findAllByText('AI 기능을 쓰려면 데이터 제공 동의가 필요해요'),
      ).not.toHaveLength(0);
      expect(getParseRequests(httpClient)).toHaveLength(2);
      expect(router.push).not.toHaveBeenCalled();
    });

    it('응답을 받지 못한 같은 글을 다시 정리하면 같은 멱등 키를 보낸다', async () => {
      // Given
      const { httpClient, haptics } = await renderForAiParse({ consent: createAgreedConsent() });
      httpClient.post
        .mockRejectedValueOnce(new TimeoutError())
        .mockResolvedValueOnce(ok(createParseMemoResponseDto()));
      await startAiParse();
      await waitFor(() => expect(haptics.notify).toHaveBeenCalledWith('error'));
      await waitFor(() => expect(screen.queryByText('할 일로 나누는 중이에요')).toBeNull());

      // When
      await startAiParse();

      // Then
      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      const [first, retried] = getParseRequests(httpClient);
      expect(first?.[2]?.headers).toEqual({ 'Idempotency-Key': expect.any(String) });
      expect(retried?.[2]?.headers).toEqual(first?.[2]?.headers);
    });
  });
});
