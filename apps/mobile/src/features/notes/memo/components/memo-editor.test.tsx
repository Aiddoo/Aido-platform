import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/constants/entitlement-query-keys';
import { type EntitlementSnapshot } from '@src/features/billing/subscription/domains/entitlement.model';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import { type Consent } from '@src/features/identity/consent/domains/consent.model';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import {
  createHttpClientStub,
  createSpeechRecognizerStub,
  createVoiceNoteStorageFake,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors/infra-error';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { Keyboard } from 'react-native';

import { createMemo } from '../__tests__/memo.fixtures';
import { createParseMemoResponseDto } from '../__tests__/parsed-memo.fixtures';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import { MemoEditor } from './memo-editor';
import { MemoList } from './memo-list';

const MEMO_ID = 5;
const SAVED_MEMO_DTO = {
  id: MEMO_ID,
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  content: '고친 메모',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:01:00.000Z',
};

const AGREED_CONSENT_DTO = {
  aiDataSharingDecision: 'AGREED',
  aiDataSharingAgreedAt: '2026-11-05T00:00:00.000Z',
  aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
};
const PARSE_MEMO_URL = 'v1/ai/parse-memo';
const CONSENT_REQUIRED_ERROR = new ApiError('AI_1311', '동의 필요', 403);

function createAgreedConsent() {
  return createConsent({
    aiDataSharingDecision: 'AGREED',
    aiDataSharingAgreedAt: toInstant(AGREED_CONSENT_DTO.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
  });
}

function getParseRequestCount(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.post.mock.calls.filter(([url]) => url === PARSE_MEMO_URL).length;
}

async function renderEditor(
  toolbar: 'stack' | 'pane',
  {
    withList = false,
    consent,
    entitlements,
  }: { withList?: boolean; consent?: Consent; entitlements?: EntitlementSnapshot } = {},
) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ memoId: String(MEMO_ID) });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
  if (consent != null) {
    queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), consent);
  }
  if (entitlements != null) {
    queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), entitlements);
  }
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.detail({ memoId: MEMO_ID }),
    createMemo({ id: MEMO_ID, content: '처음 메모' }),
  );
  queryClient.setQueryData(MEMO_QUERY_KEYS.list(), {
    pages: [
      {
        items: [createMemo({ id: MEMO_ID, content: '처음 메모' })],
        hasNext: false,
        nextCursor: null,
      },
    ],
    pageParams: [undefined],
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation((url) => {
    if (url === `v1/memos/${MEMO_ID}`) {
      return Promise.resolve(ok({ memo: SAVED_MEMO_DTO }));
    }
    if (url === 'v1/todo-categories') {
      return Promise.resolve(ok(createTodoCategoryListDto()));
    }

    return new Promise(() => undefined);
  });
  const onLeave = jest.fn();

  await renderUi(
    <Suspense fallback={null}>
      {withList && <MemoList />}
      <MemoEditor
        toolbar={toolbar === 'stack' ? MemoEditor.StackToolbar : MemoEditor.PaneToolbar}
        onLeave={onLeave}
      />
    </Suspense>,
    {
      queryClient,
      withLocalDate: true,
      withOverlay: true,
      di: {
        httpClient,
        speechRecognizer: createSpeechRecognizerStub(),
        ...createVoiceNoteStorageFake().di,
      },
    },
  );

  return { httpClient, onLeave };
}

async function editContent(content: string) {
  const input = await screen.findByDisplayValue('처음 메모');
  await act(async () => {
    fireEvent(input, 'focus');
    fireEvent.changeText(input, content);
  });
}

describe('MemoEditor', () => {
  it('저장 버튼은 입력칸에 들어간 뒤에 나타나고, 앞뒤 공백을 뺀 글자로 저장한다', async () => {
    // Given
    const { httpClient } = await renderEditor('pane');
    httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
    expect(screen.queryByLabelText('저장')).toBeNull();

    // When
    await editContent('  고친 메모  ');
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });

    // Then
    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '고친 메모',
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
    expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
  });

  it('공백만 넣고 저장하면 요청 없이 편집을 끝낸다', async () => {
    // Given
    const { httpClient } = await renderEditor('pane');

    // When
    await editContent('처음 메모  ');
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('저장'));
    });

    // Then
    await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('공백만 남기면 저장 버튼이 꺼지고 뒤로 가기는 요청 없이 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    await editContent('   ');

    // When
    await waitFor(() => expect(screen.getByLabelText('뒤로 가기')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  describe('고치던 글자가 있을 때 메뉴', () => {
    it('할 일로 바꾸기는 고친 글자를 먼저 저장한 뒤 그 글자로 시트를 연다', async () => {
      // Given
      const { httpClient } = await renderEditor('stack');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories', expect.anything()),
      );

      await act(async () => {});

      // When
      await act(async () => {
        fireEvent.press(await screen.findByText('할 일로 바꾸기'));
      });

      // Then
      await waitFor(() =>
        expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
          content: '고친 메모',
        }),
      );
      const sheet = await screen.findByTestId('memo-convert-sheet');
      expect(within(sheet).getByDisplayValue('고친 메모')).toBeTruthy();
    });

    it('저장에 실패하면 시트를 열지 않는다', async () => {
      // Given
      const { httpClient } = await renderEditor('stack');
      httpClient.patch.mockResolvedValue(err(new ApiError('MEMO_2001', '거절', 400)));
      await editContent('고친 메모');
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories', expect.anything()),
      );

      await act(async () => {});

      // When
      await act(async () => {
        fireEvent.press(await screen.findByText('할 일로 바꾸기'));
      });

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('memo-convert-sheet')).toBeNull();
    });
  });

  it('고친 글자가 있으면 뒤로 갈 때 저장한 뒤 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
    await editContent('고친 메모');

    // When
    await waitFor(() => expect(screen.getByLabelText('뒤로 가기')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('뒤로 가기로 저장하면 목록을 다시 받기 전에도 목록에 새 글이 보인다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack', { withList: true });
    httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
    await editContent('고친 메모');
    expect(screen.getByText('처음 메모')).toBeTruthy();

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(screen.getByText('고친 메모')).toBeTruthy();
    expect(screen.queryByText('처음 메모')).toBeNull();
  });

  it('고친 글자가 없으면 저장 요청 없이 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    await screen.findByDisplayValue('처음 메모');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('서버가 거절하면 글자를 지키려고 화면에 남는다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    httpClient.patch.mockResolvedValue(err(new ApiError('MEMO_2001', '거절', 400)));
    await editContent('고친 메모');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
  });

  it('연결 문제로 못 보내면 초안에 남기고 떠난다', async () => {
    // Given
    const { httpClient, onLeave } = await renderEditor('stack');
    httpClient.patch.mockRejectedValue(new NetworkError());
    await editContent('고친 메모');

    // When
    await act(async () => {
      fireEvent.press(screen.getByLabelText('뒤로 가기'));
    });

    // Then
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
  });

  describe('저장 버튼과 뒤로 가기의 차이', () => {
    let dismissKeyboard: jest.SpyInstance;

    beforeEach(() => {
      dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    });

    afterEach(() => {
      dismissKeyboard.mockRestore();
    });

    it('저장 버튼은 화면에 남은 채 키보드를 내리고 편집을 끝낸다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('pane');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(dismissKeyboard).toHaveBeenCalledTimes(1);
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('저장 버튼으로 저장한 뒤에는 바뀐 글자가 없어 뒤로 가기가 다시 보내지 않는다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('stack');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });
      await waitFor(() => expect(dismissKeyboard).toHaveBeenCalledTimes(1));

      // When
      await act(async () => {
        fireEvent.press(screen.getByLabelText('뒤로 가기'));
      });

      // Then
      await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });

    it('저장 버튼이 거절되면 글자와 편집 상태를 그대로 두고 키보드도 내리지 않는다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('pane');
      httpClient.patch.mockResolvedValue(err(new ApiError('MEMO_2001', '거절', 400)));
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('저장')).toBeTruthy();
      expect(screen.getByDisplayValue('고친 메모')).toBeTruthy();
      expect(dismissKeyboard).not.toHaveBeenCalled();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('저장 버튼은 연결 문제여도 떠나지 않고 편집을 이어 가게 한다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('pane');
      httpClient.patch.mockRejectedValue(new NetworkError());
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('저장')).toBeTruthy();
      expect(dismissKeyboard).not.toHaveBeenCalled();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('뒤로 가기로 저장하면 키보드를 직접 내리지 않고 떠난다', async () => {
      // Given
      const { httpClient, onLeave } = await renderEditor('stack');
      httpClient.patch.mockResolvedValue(ok({ message: 'updated', memo: SAVED_MEMO_DTO }));
      await editContent('고친 메모');

      // When
      await act(async () => {
        fireEvent.press(screen.getByLabelText('뒤로 가기'));
      });

      // Then
      await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
      expect(dismissKeyboard).not.toHaveBeenCalled();
    });
  });

  describe('AI로 할 일 나누기', () => {
    async function renderForAiParse({ consent }: { consent: Consent }) {
      const rendered = await renderEditor('stack', {
        consent,
        entitlements: createEntitlementSnapshot(),
      });
      await screen.findByDisplayValue('처음 메모');
      await waitFor(() =>
        expect(rendered.httpClient.get).toHaveBeenCalledWith(
          'v1/todo-categories',
          expect.anything(),
        ),
      );
      await act(async () => {});

      return rendered;
    }

    async function startAiParse() {
      // 동의를 답할 때까지 끝나지 않는 핸들러라 기다리지 않는다
      fireEvent.press(await screen.findByText('AI로 할 일 나누기')).catch(() => undefined);
    }

    it('이번 달 한도를 다 썼으면 안내를 띄우고 정리를 요청하지 않는다', async () => {
      // Given
      const { httpClient } = await renderEditor('stack', {
        consent: createAgreedConsent(),
        entitlements: createEntitlementSnapshot({ used: { AI_PARSE: 10 } }),
      });
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories', expect.anything()),
      );
      await act(async () => {});

      // When
      await startAiParse();

      // Then
      expect(await screen.findByText('이번 달 AI 할 일 만들기를 다 썼어요')).toBeTruthy();
      expect(getParseRequestCount(httpClient)).toBe(0);
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
      expect(getParseRequestCount(httpClient)).toBe(0);
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
      expect(getParseRequestCount(httpClient)).toBe(1);
    });

    it('정리하는 사이 동의가 사라졌으면 동의를 물은 뒤 한 번만 다시 요청한다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createAgreedConsent() });
      httpClient.patch.mockResolvedValue(ok(AGREED_CONSENT_DTO));
      httpClient.post
        .mockResolvedValueOnce(err(CONSENT_REQUIRED_ERROR))
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
      expect(getParseRequestCount(httpClient)).toBe(2);
    });

    it('동의한 뒤에도 서버가 동의 없음으로 거절하면 다시 묻지 않고 이유만 알린다', async () => {
      // Given
      const { httpClient } = await renderForAiParse({ consent: createAgreedConsent() });
      httpClient.patch.mockResolvedValue(ok(AGREED_CONSENT_DTO));
      httpClient.post.mockResolvedValue(err(CONSENT_REQUIRED_ERROR));
      await startAiParse();
      await screen.findByTestId('ai-consent-sheet');

      // When
      fireEvent.press(screen.getByTestId('ai-consent-agree')).catch(() => undefined);

      // Then
      expect(
        await screen.findAllByText('AI 기능을 쓰려면 데이터 제공 동의가 필요해요'),
      ).not.toHaveLength(0);
      expect(getParseRequestCount(httpClient)).toBe(2);
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
