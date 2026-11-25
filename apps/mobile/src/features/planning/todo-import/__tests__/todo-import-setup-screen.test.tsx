import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';
import { fail, ok } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import type { OsPermission } from '@src/core/ports/os-permission';
import type { ImportCollectionRecord, ImportEventRecord } from '@src/core/ports/todo-import-source';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  createTodoImportSourceStub,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import TodoImportSetupRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/todo-import';
import { createTodoImportApiError, createTodoImportDto, IMPORT_ID } from './todo-import.fixtures';

/** 2026-11-24 10:00 KST. 기본 기간은 이날부터 2026-12-23까지다 */
const NOW = new Date('2026-11-24T01:00:00.000Z');
const OTHER_IMPORT_ID = 'clz7x5p8k0011qz0z8z8z8z8z';
const START_PATH = 'v1/todo-imports';

const PERSONAL: ImportCollectionRecord = {
  collectionKey: 'a'.repeat(64),
  title: '개인',
  color: '#FF6B43',
  accountName: 'iCloud',
  accountKind: 'cloud',
};
const WORK: ImportCollectionRecord = {
  collectionKey: 'c'.repeat(64),
  title: '회사',
  color: '#339AF0',
  accountName: 'iCloud',
  accountKind: 'cloud',
};

function createEvents(collectionKey: string, count: number, digit: string): ImportEventRecord[] {
  return Array.from({ length: count }, (_, index): ImportEventRecord => ({
    collectionKey,
    occurrenceKey: `${digit}${String(index).padStart(63, '0')}`,
    title: `일정 ${index + 1}`,
    time: { kind: 'allDay', startDate: '2026-11-25', endDateExclusive: '2026-11-26' },
    isCanceled: false,
  }));
}

type StartResponse = Awaited<ReturnType<HttpClient['post']>>;

interface RenderSetupOptions {
  permission?: OsPermission;
  /** 개인 캘린더의 일정 수. 회사 캘린더는 늘 3개다 */
  personalEventCount?: number;
  startImport?: () => Promise<StartResponse>;
}

async function renderSetup({
  permission = { status: 'granted', canAskAgain: true },
  personalEventCount = 2,
  startImport = async () => ok({ todoImport: createTodoImportDto() }),
}: RenderSetupOptions = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      // 기본(id 1)·업무(id 2)
      'v1/todo-categories': ok(createTodoCategoryListDto()),
      'v1/todos/resource-limit': ok({ maxPerCategory: 300, activeCount: 5 }),
      // 시작 뒤 업로드는 이 화면의 일이 아니다. 서버가 이미 넘겼다고 답해 업로드가 바로 끝난다
      [`v1/todo-imports/${IMPORT_ID}`]: ok({
        todoImport: createTodoImportDto({ status: 'QUEUED' }),
      }),
    }),
  );
  httpClient.post.mockImplementation(respondByPath({ [START_PATH]: startImport }));
  const todoImportSource = createTodoImportSourceStub({
    permission,
    collections: [PERSONAL, WORK],
    events: [
      ...createEvents(PERSONAL.collectionKey, personalEventCount, '1'),
      ...createEvents(WORK.collectionKey, 3, '2'),
    ],
  });

  await renderScreen(<TodoImportSetupRoute />, {
    di: createTestDi({ ports: { httpClient, todoImportSource } }),
    withLocalDate: true,
    withOverlay: true,
  });

  return { httpClient, todoImportSource };
}

function findStartRequests(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.post.mock.calls.filter(([path]) => path === START_PATH);
}

type HostNode = ReturnType<typeof screen.getByText>;

/** 진행 점 줄은 읽기에서 숨긴 막대 하나와 점들이다. 단계 제목 위 첫 숨긴 줄에서 막대를 빼고 센다 */
function countProgressDots() {
  const visit = (node: HostNode): number | null => {
    if (
      node.props.accessibilityElementsHidden === true &&
      node.props.importantForAccessibility === 'no-hide-descendants'
    ) {
      return node.children.length - 1;
    }
    for (const child of node.children) {
      if (typeof child !== 'string') {
        const found = visit(child);
        if (found != null) {
          return found;
        }
      }
    }
    return null;
  };
  return screen.root == null ? null : visit(screen.root);
}

const CALENDARS_TITLE = '가져올 캘린더를 골라주세요';
const CATEGORIES_TITLE = '어디에 넣을까요?';
const OPTIONS_TITLE = '마지막으로 확인해주세요';
const PERMISSION_TITLE = '캘린더 일정을 할 일로 가져올게요';

async function pressNext() {
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
}

async function goToCategories() {
  // 캘린더 목록을 받기 전에는 "일정 0개"로 버튼이 꺼져 있다
  await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
  await pressNext();
  await screen.findByText(CATEGORIES_TITLE);
  // 넣을 곳의 남은 자리까지 받아 단계가 다 그려졌다
  await screen.findByText(/더 넣을 수 있어요/);
}

async function goToOptions() {
  await pressNext();
  await screen.findByText(OPTIONS_TITLE);
}

async function chooseCategory(name: string) {
  await fireEvent.press(await screen.findByRole('radio', { name }));
  await waitFor(() => expect(screen.queryByText('내 아이두 카테고리')).not.toBeOnTheScreen());
}

async function splitAndMoveWorkTo(categoryName: string) {
  await fireEvent.press(screen.getByText('캘린더마다 다른 곳에 넣을래요'));
  await fireEvent.press(await screen.findByRole('button', { name: /'회사'의 일정을/ }));
  await chooseCategory(categoryName);
  await screen.findByRole('button', {
    name: new RegExp(`'회사'의 일정을 아이두 카테고리 '${categoryName}'에 넣기`),
  });
}

async function pressImport() {
  await fireEvent.press(screen.getByRole('button', { name: '가져오기' }));
}

describe('캘린더 가져오기 설정 화면', () => {
  setupFakeTimersPerTest({ now: NOW, advanceTimers: true });

  describe('권한', () => {
    it('이미 허용한 기기는 캘린더 고르기에서 시작하고 진행 점은 세 단계다', async () => {
      // Given
      await renderSetup();

      // When
      await screen.findByText(CALENDARS_TITLE);

      // Then
      expect(screen.queryByText(PERMISSION_TITLE)).not.toBeOnTheScreen();
      expect(countProgressDots()).toBe(3);
    });

    it('묻기 전이면 안내 뒤 허용하자마자 캘린더 고르기로 바뀌고 뒤로 가도 안내로 돌아오지 않는다', async () => {
      // Given
      const { todoImportSource } = await renderSetup({
        permission: { status: 'undetermined', canAskAgain: true },
      });
      todoImportSource.requestPermission.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });
      await screen.findByText(PERMISSION_TITLE);
      expect(countProgressDots()).toBe(4);

      // When
      await fireEvent.press(screen.getByRole('button', { name: '계속' }));
      await screen.findByText(CALENDARS_TITLE);
      await goToCategories();
      await fireEvent.press(screen.getByRole('button', { name: '이전' }));

      // Then
      expect(await screen.findByText(CALENDARS_TITLE)).toBeOnTheScreen();
      expect(screen.queryByText(PERMISSION_TITLE)).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: '이전' })).not.toBeOnTheScreen();
      expect(todoImportSource.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('거절한 기기는 설정 열기만 보이고 계속 버튼이 없다', async () => {
      // Given
      await renderSetup({ permission: { status: 'denied', canAskAgain: false } });

      // When
      const openSettings = await screen.findByRole('button', { name: '설정 열기' });

      // Then
      expect(openSettings).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: '계속' })).not.toBeOnTheScreen();
    });
  });

  describe('캘린더 고르기', () => {
    it('캘린더를 하나도 고르지 않으면 다음으로 넘어갈 수 없다', async () => {
      // Given
      await renderSetup();
      await screen.findByText('일정 5개를 가져와요');

      // When
      await fireEvent.press(screen.getByRole('checkbox', { name: '개인, 2개' }));
      await fireEvent.press(screen.getByRole('checkbox', { name: '회사, 3개' }));

      // Then
      await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeDisabled());
    });

    it('한 번에 가져올 수 있는 수를 넘으면 다음 버튼이 꺼지고 넘었다고 알린다', async () => {
      // Given
      const personalEventCount = TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT;

      // When
      await renderSetup({ personalEventCount });

      // Then
      expect(await screen.findByText(/^한 번에 3,?000개까지 가져올 수 있어요/)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    });
  });

  describe('카테고리', () => {
    it('카테고리 단계에서 뒤로 갔다 다시 와도 고른 캘린더와 넣을 곳이 남아 있다', async () => {
      // Given
      await renderSetup();
      await screen.findByText('일정 5개를 가져와요');
      await fireEvent.press(screen.getByRole('checkbox', { name: '회사, 3개' }));
      await goToCategories();
      await fireEvent.press(screen.getByRole('button', { name: /^넣을 곳, 기본/ }));
      await chooseCategory('업무');

      // When
      await fireEvent.press(screen.getByRole('button', { name: '이전' }));
      await screen.findByText(CALENDARS_TITLE);
      const work = screen.getByRole('checkbox', { name: '회사, 3개' });
      await pressNext();

      // Then
      expect(work).not.toBeChecked();
      expect(await screen.findByRole('button', { name: /^넣을 곳, 업무/ })).toBeOnTheScreen();
    });

    it('캘린더마다 넣기로 한 곳을 바꾸면 시작 요청의 대상이 캘린더마다 갈린다', async () => {
      // Given
      const { httpClient } = await renderSetup();
      await goToCategories();
      await splitAndMoveWorkTo('업무');
      await goToOptions();

      // When
      await pressImport();

      // Then
      await waitFor(() => expect(findStartRequests(httpClient)).toHaveLength(1));
      expect(findStartRequests(httpClient)[0]?.[1]).toMatchObject({
        targets: [
          { targetKey: 'category-1', kind: 'EXISTING_CATEGORY', categoryId: 1 },
          { targetKey: 'category-2', kind: 'EXISTING_CATEGORY', categoryId: 2 },
        ],
        collections: [
          { collectionKey: PERSONAL.collectionKey, targetKey: 'category-1', expectedItemCount: 2 },
          { collectionKey: WORK.collectionKey, targetKey: 'category-2', expectedItemCount: 3 },
        ],
      });
    });
  });

  describe('시작', () => {
    it('고른 기간과 옵션으로 시작하고 진행 화면으로 바꾼다', async () => {
      // Given
      const { httpClient } = await renderSetup();
      await goToCategories();
      await goToOptions();
      await fireEvent.press(screen.getByRole('switch', { name: /시간도 가져오기/ }));
      await fireEvent.press(screen.getByRole('switch', { name: /친구에게 공개/ }));

      // When
      await pressImport();

      // Then
      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith({
          pathname: '/todo-import/[importId]',
          params: { importId: IMPORT_ID },
        }),
      );
      expect(findStartRequests(httpClient)).toEqual([
        [
          START_PATH,
          {
            source: 'DEVICE_CALENDAR',
            startDate: '2026-11-24',
            endDate: '2026-12-23',
            timeMode: 'DATE_ONLY',
            visibility: 'PUBLIC',
            targets: [{ targetKey: 'category-1', kind: 'EXISTING_CATEGORY', categoryId: 1 }],
            collections: [
              {
                collectionKey: PERSONAL.collectionKey,
                targetKey: 'category-1',
                expectedItemCount: 2,
              },
              { collectionKey: WORK.collectionKey, targetKey: 'category-1', expectedItemCount: 3 },
            ],
          },
          expect.anything(),
        ],
      ]);
    });

    it('서버가 넣을 곳을 거절하면 카테고리 단계에서 그 캘린더 줄에 사유를 보이고 넣을 곳을 바꾸면 지운다', async () => {
      // Given
      const reason = '카테고리가 삭제됐어요. 다른 카테고리를 골라주세요';
      await renderSetup({
        startImport: async () =>
          fail(
            createTodoImportApiError({
              code: ErrorCode.TODO_IMPORT_2303,
              details: { targets: [{ targetKey: 'category-2', reason: 'CATEGORY_NOT_FOUND' }] },
            }),
          ),
      });
      await goToCategories();
      await splitAndMoveWorkTo('업무');
      await goToOptions();
      await pressImport();
      await screen.findByText(reason);
      expect(screen.getByText(CATEGORIES_TITLE)).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: new RegExp(`'회사'의 일정을.*${reason}`) }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: /'개인'의 일정을 아이두 카테고리 '기본'에 넣기$/ }),
      ).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByRole('button', { name: /'회사'의 일정을/ }));
      await chooseCategory('기본');

      // Then
      await waitFor(() => expect(screen.queryByText(reason)).not.toBeOnTheScreen());
    });

    it('이미 진행 중인 가져오기가 있다고 하면 그 가져오기 화면으로 간다', async () => {
      // Given
      await renderSetup({
        startImport: async () =>
          fail(
            createTodoImportApiError({
              code: ErrorCode.TODO_IMPORT_2301,
              details: { importId: OTHER_IMPORT_ID },
            }),
          ),
      });
      await goToCategories();
      await goToOptions();

      // When
      await pressImport();

      // Then
      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith({
          pathname: '/todo-import/[importId]',
          params: { importId: OTHER_IMPORT_ID },
        }),
      );
    });

    it('가져오기를 두 번 눌러도 시작 요청은 한 번이다', async () => {
      // Given
      const pending = createPendingResponse(ok({ todoImport: createTodoImportDto() }));
      const { httpClient } = await renderSetup({ startImport: () => pending.response });
      await goToCategories();
      await goToOptions();

      const importButton = screen.getByRole('button', { name: '가져오기' });

      // When
      await fireEvent.press(importButton);
      await fireEvent.press(importButton);
      await act(() => jest.advanceTimersByTimeAsync(0));

      // Then
      expect(findStartRequests(httpClient)).toHaveLength(1);
      await act(async () => pending.settle());
      await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    });
  });
});
