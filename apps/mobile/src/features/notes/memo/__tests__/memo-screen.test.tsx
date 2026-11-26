import { ErrorCode, HttpStatus } from '@aido/api/errors';
import '@src/shared/i18n/init';
import { type ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import type { RequestConfig } from '@src/core/ports/http-client';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import {
  countGetRequests,
  findHostsWithProp,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { ServerError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  createVoiceNoteStorageFake,
  respondByPath,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { View } from 'react-native';

import MemoScreen from '../../../../../app/(app)/(tabs)/(memos)/memo/index';
import { MEMO_QUERY_KEYS } from '../queries/memo-query-keys';
import { countEvents, createMemoDto, createMemoListDto, MEMO_ID } from './memo.test-utils';

const PHONE_WIDTH = 390;
const FOLD_WIDTH = 900;
const SECOND_MEMO_ID = 6;
const NEXT_PAGE_MEMO_ID = 7;
const SHOPPING = createMemoDto({ id: MEMO_ID, content: '장보기' });
const LAUNDRY = createMemoDto({ id: SECOND_MEMO_ID, content: '빨래' });
const NEXT_PAGE_MEMO = createMemoDto({ id: NEXT_PAGE_MEMO_ID, content: '다음 쪽 메모' });

type GetResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

interface MemoServerOptions {
  /** 커서마다 서버가 돌려주는 메모 쪽. 키 `first`가 첫 쪽이다 */
  pages?: Record<string, GetResponse>;
  get?: Record<string, GetResponse>;
}

function createMemoServer({ pages = {}, get = {} }: MemoServerOptions = {}) {
  const httpClient = createHttpClientStub();
  const memoPages: Record<string, GetResponse> = {
    first: ok(createMemoListDto([SHOPPING, LAUNDRY])),
    ...pages,
  };
  httpClient.get.mockImplementation((path: string, config?: RequestConfig) => {
    if (path === 'v1/memos') {
      const response = memoPages[String(config?.params?.cursor ?? 'first')];
      if (response == null) {
        throw new Error(`메모 쪽 ${String(config?.params?.cursor)} 응답을 정하지 않았습니다`);
      }
      return typeof response === 'function' ? response() : Promise.resolve(response);
    }
    return respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/memos/resource-limit': ok({ currentCount: 2, maxPerUser: 20 }),
      'v1/notifications/inbox/unread-count': ok({ unreadCount: 0 }),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/todo-categories': ok(createTodoCategoryListDto()),
      [`v1/memos/${MEMO_ID}`]: ok({ memo: SHOPPING }),
      ...get,
    })(path);
  });

  return httpClient;
}

async function renderMemoScreen({
  width = PHONE_WIDTH,
  params = {},
  server,
}: {
  width?: number;
  params?: Record<string, string>;
  server?: MemoServerOptions;
} = {}) {
  stubWindowDimensions(width);
  createRouteParamsFake(params);
  const httpClient = createMemoServer(server);
  const analytics = createAnalyticsStub();
  const rendered = await renderScreen(<MemoScreen />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      ports: { httpClient, analytics, ...createVoiceNoteStorageFake().ports },
    }),
  });

  return { httpClient, analytics, ...rendered };
}

function getMemoRequestCursors(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.get.mock.calls
    .filter(([path]) => path === 'v1/memos')
    .map(([, config]) => config?.params?.cursor);
}

/** 목록 카드는 칸 크기를 재야 다음 쪽까지 그려져, 받은 쪽은 캐시로 본다 */
function getCachedMemoIds(queryClient: QueryClient) {
  return queryClient
    .getQueryData(MEMO_QUERY_KEYS.list())
    ?.pages.flatMap(({ items }) => items.map(({ id }) => id));
}

async function openCardDeleteDialog() {
  const card = await screen.findByTestId(`memo-item-${MEMO_ID}`);
  await act(async () => {
    // 다이얼로그의 답을 기다려 끝나지 않는 동작이라 기다리지 않는다
    fireEvent(card, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } }).catch(
      () => undefined,
    );
  });
  await screen.findByText('메모를 삭제할까요?');
}

function getMemoList() {
  const [list] = findHostsWithProp('refreshControl');
  if (list == null) {
    throw new Error('메모 목록이 없습니다');
  }
  return list;
}

describe('MemoScreen', () => {
  describe('목록', () => {
    it('처음 열면 메모 첫 쪽을 한 번 받아 카드로 보인다', async () => {
      // Given
      const { httpClient } = await renderMemoScreen();

      // When
      await screen.findByText('장보기');

      // Then
      expect(screen.getByText('빨래')).toBeTruthy();
      await waitFor(() =>
        expect(countGetRequests(httpClient)).toEqual({
          'v1/auth/me': 1,
          'v1/entitlements': 1,
          'v1/memos': 1,
          'v1/memos/resource-limit': 1,
          'v1/notifications/inbox/unread-count': 1,
        }),
      );
      expect(getMemoRequestCursors(httpClient)).toEqual([undefined]);
    });

    it('다음 쪽이 있으면 더 보기를 눌러 다음 커서로 받아 이어 붙인다', async () => {
      // Given
      const { httpClient, queryClient } = await renderMemoScreen({
        server: {
          pages: {
            first: ok(createMemoListDto([SHOPPING, LAUNDRY], { nextCursor: SECOND_MEMO_ID })),
            [SECOND_MEMO_ID]: ok(createMemoListDto([NEXT_PAGE_MEMO])),
          },
        },
      });
      await screen.findByText('장보기');

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByText('메모 더 보기'));
      });

      // Then
      await waitFor(() => expect(screen.queryByText('메모 더 보기')).toBeNull());
      expect(getMemoRequestCursors(httpClient)).toEqual([undefined, SECOND_MEMO_ID]);
      expect(getCachedMemoIds(queryClient)).toEqual([MEMO_ID, SECOND_MEMO_ID, NEXT_PAGE_MEMO_ID]);
    });

    it('다음 쪽을 받지 못하면 알리고 다시 시도로 다시 받는다', async () => {
      // Given
      let nextPageCount = 0;
      const { httpClient, queryClient } = await renderMemoScreen({
        server: {
          pages: {
            first: ok(createMemoListDto([SHOPPING, LAUNDRY], { nextCursor: SECOND_MEMO_ID })),
            [SECOND_MEMO_ID]: async () => {
              nextPageCount += 1;
              if (nextPageCount === 1) {
                throw new ServerError(500);
              }
              return ok(createMemoListDto([NEXT_PAGE_MEMO]));
            },
          },
        },
      });
      await act(async () => {
        await fireEvent.press(await screen.findByText('메모 더 보기'));
      });
      expect(await screen.findByText('다음 메모를 불러오지 못했어요')).toBeTruthy();

      // When
      await act(async () => {
        await fireEvent.press(screen.getByText('다시 시도'));
      });

      // Then
      await waitFor(() => expect(screen.queryByText('다음 메모를 불러오지 못했어요')).toBeNull());
      expect(getMemoRequestCursors(httpClient)).toEqual([
        undefined,
        SECOND_MEMO_ID,
        SECOND_MEMO_ID,
      ]);
      expect(getCachedMemoIds(queryClient)).toEqual([MEMO_ID, SECOND_MEMO_ID, NEXT_PAGE_MEMO_ID]);
    });

    it('당겨서 새로고침하면 목록과 개수 한도를 다시 받는다', async () => {
      // Given
      const { httpClient } = await renderMemoScreen();
      await screen.findByText('장보기');
      await waitFor(() => expect(countGetRequests(httpClient)['v1/memos/resource-limit']).toBe(1));

      // When
      await act(async () => getMemoList().props.refreshControl.props.onRefresh());

      // Then
      await waitFor(() =>
        expect(getMemoRequestCursors(httpClient)).toEqual([undefined, undefined]),
      );
      expect(countGetRequests(httpClient)['v1/memos/resource-limit']).toBe(2);
    });

    it('메모가 없으면 빈 안내를 보인다', async () => {
      // When
      await renderMemoScreen({ server: { pages: { first: ok(createMemoListDto([])) } } });

      // Then
      expect(await screen.findByText('아직 메모가 없어요')).toBeTruthy();
    });

    it('목록을 받지 못하면 알리고 다시 시도로 다시 받는다', async () => {
      // Given
      let firstPageCount = 0;
      const { httpClient } = await renderMemoScreen({
        server: {
          pages: {
            first: async () => {
              firstPageCount += 1;
              if (firstPageCount === 1) {
                throw new ServerError(500);
              }
              return ok(createMemoListDto([SHOPPING]));
            },
          },
        },
      });
      expect(await screen.findByText('메모를 불러오지 못했어요')).toBeTruthy();

      // When
      await act(async () => {
        await fireEvent.press(screen.getByText('다시 시도'));
      });

      // Then
      expect(await screen.findByText('장보기')).toBeTruthy();
      expect(getMemoRequestCursors(httpClient)).toEqual([undefined, undefined]);
    });

    it('개수 한도에 닿았으면 새 메모를 열지 않고 지우면 다시 쓸 수 있다고 알린다', async () => {
      // Given
      await renderMemoScreen({
        server: { get: { 'v1/memos/resource-limit': ok({ currentCount: 20, maxPerUser: 20 }) } },
      });
      await screen.findByText('장보기');

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByLabelText('새 메모'));
      });

      // Then
      expect(await screen.findAllByText('메모는 20개까지 쓸 수 있어요')).toHaveLength(1);
      expect(router.push).not.toHaveBeenCalled();
    });

    it('한도 안이면 새 메모 화면으로 간다', async () => {
      // Given
      await renderMemoScreen();
      await screen.findByText('장보기');

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByLabelText('새 메모'));
      });

      // Then
      expect(router.push).toHaveBeenCalledWith('/memo/create');
    });
  });

  describe('카드 동작', () => {
    it('좁은 화면에서 카드를 누르면 상세 화면으로 간다', async () => {
      // Given
      await renderMemoScreen();

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByTestId(`memo-item-${MEMO_ID}`));
      });

      // Then
      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/memo/[memoId]',
        params: { memoId: MEMO_ID },
      });
    });

    it('스크린리더 동작으로 카드에서 바로 메모를 고정하고 한 번 남긴다', async () => {
      // Given
      const { httpClient, analytics } = await renderMemoScreen();
      httpClient.patch.mockResolvedValue(
        ok({ message: 'updated', memo: { ...SHOPPING, isPinned: true } }),
      );

      // When
      await act(async () => {
        await fireEvent(await screen.findByTestId(`memo-item-${MEMO_ID}`), 'accessibilityAction', {
          nativeEvent: { actionName: 'togglePin' },
        });
      });

      // Then
      await waitFor(() =>
        expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}/pin`, {
          isPinned: true,
        }),
      );
      expect(countEvents(analytics, 'memo_pin_toggled')).toBe(1);
    });

    it('카드 메뉴로 지우면 확인 뒤 지우고 다시 받은 목록에서 빠진다', async () => {
      // Given
      let isDeleted = false;
      const { httpClient, analytics } = await renderMemoScreen({
        server: {
          pages: {
            first: async () => ok(createMemoListDto(isDeleted ? [LAUNDRY] : [SHOPPING, LAUNDRY])),
          },
        },
      });
      httpClient.delete.mockImplementation(async () => {
        isDeleted = true;
        return ok({ message: 'deleted' });
      });
      await openCardDeleteDialog();

      // When
      await act(async () => {
        await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
      });

      // Then
      await waitFor(() => expect(screen.queryByText('장보기')).toBeNull());
      expect(screen.getByText('빨래')).toBeTruthy();
      expect(httpClient.delete).toHaveBeenCalledTimes(1);
      expect(countEvents(analytics, 'memo_deleted')).toBe(1);
    });

    it('지우지 못하면 다이얼로그와 카드를 남긴다', async () => {
      // Given
      const { httpClient, analytics } = await renderMemoScreen();
      httpClient.delete.mockRejectedValue(new ServerError(500));
      await openCardDeleteDialog();

      // When
      await act(async () => {
        await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
      });

      // Then
      await waitFor(() => expect(httpClient.delete).toHaveBeenCalledTimes(1));
      expect(screen.getByText('메모를 삭제할까요?')).toBeTruthy();
      expect(screen.getByText('장보기')).toBeTruthy();
      expect(countEvents(analytics, 'memo_deleted')).toBe(0);
    });
  });

  describe('넓은 화면', () => {
    it('고른 메모가 없으면 옆 칸에 고르라는 안내를 보인다', async () => {
      // When
      await renderMemoScreen({ width: FOLD_WIDTH });

      // Then
      expect(await screen.findByText('선택한 메모가 없어요')).toBeTruthy();
    });

    it('카드를 누르면 이동하지 않고 고른 메모를 주소에 적어 옆 칸에 연다', async () => {
      // Given
      const { httpClient } = await renderMemoScreen({ width: FOLD_WIDTH });

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByTestId(`memo-item-${MEMO_ID}`));
      });

      // Then
      expect(router.setParams).toHaveBeenCalledWith({ memoId: String(MEMO_ID) });
      expect(router.navigate).not.toHaveBeenCalled();
      expect(await screen.findByDisplayValue('장보기')).toBeTruthy();
      expect(countGetRequests(httpClient)[`v1/memos/${MEMO_ID}`]).toBe(1);
    });

    it('옆 칸의 편집기에서 고친 글을 저장 버튼으로 보내고 칸에 남으며 목록 카드도 새 글로 바뀐다', async () => {
      // Given
      const { httpClient } = await renderMemoScreen({
        width: FOLD_WIDTH,
        params: { memoId: String(MEMO_ID) },
      });
      httpClient.patch.mockResolvedValue(
        ok({ message: 'updated', memo: { ...SHOPPING, content: '장보기 우유' } }),
      );
      const input = await screen.findByDisplayValue('장보기');
      expect(screen.getByText('장보기')).toBeTruthy();
      // 입력칸에 들어가기 전에는 저장 버튼이 없다
      expect(screen.queryByLabelText('저장')).toBeNull();
      await act(async () => {
        await fireEvent(input, 'focus');
        await fireEvent.changeText(input, '장보기 우유');
      });

      // When
      await act(async () => {
        await fireEvent.press(await screen.findByLabelText('저장'));
      });

      // Then
      await waitFor(() => expect(screen.queryByLabelText('저장')).toBeNull());
      expect(httpClient.patch).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`, {
        content: '장보기 우유',
      });
      expect(screen.getByDisplayValue('장보기 우유')).toBeTruthy();
      expect(await screen.findByText('장보기 우유')).toBeTruthy();
      expect(screen.queryByText('장보기')).toBeNull();
      expect(router.back).not.toHaveBeenCalled();
    });

    describe('옆 칸의 ⋯ 메뉴', () => {
      // 메뉴는 누른 단추의 자리를 잰 뒤에 펼친다. RN의 measure는 이미 jest.fn이라 restoreMocks가 구현을 되돌리지 못해 직접 비운다
      beforeEach(() => {
        jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
          if (typeof callback === 'function') {
            callback(0, 0, 36, 36, 860, 60);
          }
        });
      });

      afterEach(() => {
        jest.mocked(View.prototype.measure).mockReset();
      });

      it('메뉴로 메모를 지우면 지우는 요청을 보내고 고른 메모를 풀어 빈 칸으로 돌아간다', async () => {
        // Given
        const { httpClient } = await renderMemoScreen({
          width: FOLD_WIDTH,
          params: { memoId: String(MEMO_ID) },
        });
        httpClient.delete.mockResolvedValue(ok({ message: 'deleted' }));
        await screen.findByDisplayValue('장보기');
        await act(async () => {
          await fireEvent.press(screen.getByTestId('memo-more'));
        });
        // 펼친 메뉴는 자기 크기를 잰 뒤에야 누를 수 있다
        for (const menuContent of findHostsWithProp('aria-modal')) {
          await fireEvent(menuContent, 'layout', {
            nativeEvent: { layout: { x: 640, y: 100, width: 220, height: 160 } },
          });
        }
        await act(async () => {
          // 다이얼로그의 답을 기다려 끝나지 않는 동작이라 기다리지 않는다
          fireEvent.press(await screen.findByText('삭제')).catch(() => undefined);
        });
        await screen.findByText('메모를 삭제할까요?');

        // When
        await act(async () => {
          await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
        });

        // Then
        await waitFor(() => expect(router.setParams).toHaveBeenCalledWith({ memoId: undefined }));
        expect(httpClient.delete).toHaveBeenCalledTimes(1);
        expect(httpClient.delete).toHaveBeenCalledWith(`v1/memos/${MEMO_ID}`);
        expect(await screen.findByText('선택한 메모가 없어요')).toBeTruthy();
      });
    });

    it('옆 칸에서 볼 수 없는 메모는 안내하고 돌아가기로 고른 메모를 지워 빈 칸으로 돌아간다', async () => {
      // Given
      await renderMemoScreen({
        width: FOLD_WIDTH,
        params: { memoId: '99' },
        server: {
          get: {
            'v1/memos/99': fail(
              createApiError(ErrorCode.MEMO_2001, {
                message: '메모 없음',
                status: HttpStatus.NOT_FOUND,
              }),
            ),
          },
        },
      });
      expect(await screen.findByText('지금은 볼 수 없는 메모예요')).toBeTruthy();

      // When
      await act(async () => {
        await fireEvent.press(screen.getByText('뒤로 가기'));
      });

      // Then
      expect(router.setParams).toHaveBeenCalledWith({ memoId: undefined });
      expect(await screen.findByText('선택한 메모가 없어요')).toBeTruthy();
    });

    it('고른 메모가 있는 채로 화면이 접히면 그 메모를 상세 화면으로 넘긴다', async () => {
      // Given
      const dimensions = stubWindowDimensions(FOLD_WIDTH);
      createRouteParamsFake({ memoId: String(MEMO_ID) });
      const httpClient = createMemoServer();
      const { rerender } = await renderScreen(<MemoScreen />, {
        withLocalDate: true,
        withOverlay: true,
        di: createTestDi({ ports: { httpClient, ...createVoiceNoteStorageFake().ports } }),
      });
      await screen.findByDisplayValue('장보기');

      // When
      dimensions.mockReturnValue({ width: PHONE_WIDTH, height: 800, scale: 2, fontScale: 1 });
      await rerender(<MemoScreen />);

      // Then
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/memo/[memoId]',
          params: { memoId: MEMO_ID },
        }),
      );
      expect(router.setParams).toHaveBeenCalledWith({ memoId: undefined });
    });
  });

  describe('열 수', () => {
    function getColumnCount() {
      const [list] = findHostsWithProp('numColumns');
      return list?.props.numColumns;
    }

    it.each([
      { scenario: '좁은 화면은 두 열', width: PHONE_WIDTH, expected: 2 },
      { scenario: '넓은 화면의 목록 칸은 한 열', width: FOLD_WIDTH, expected: 1 },
    ])('$scenario로 놓는다', async ({ width, expected }) => {
      // When
      await renderMemoScreen({ width });
      await screen.findByText('장보기');

      // Then
      expect(getColumnCount()).toBe(expected);
    });
  });
});
