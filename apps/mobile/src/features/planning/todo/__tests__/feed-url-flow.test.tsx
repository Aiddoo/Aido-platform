import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { DateKey } from '@src/shared/date/date-key';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createTestDi,
  stubWindowDimensions,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderRouteHook } from '@src/testing/render-route-hook';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useFeedAction, useFeedDateKey, useFeedFriendId } from '../hooks/use-feed-params';
import {
  useFeedSelectedTodoId,
  useFeedTodoDetailHandoff,
} from '../hooks/use-feed-selected-todo-id';

jest.unmock('expo-router');

const COMMENT = 'cmt92zn3n000b7voxx9quc2th';
const FRIEND = 'cmfriend000000000000000001';
const FOLD_WIDTH = 900;
const PHONE_WIDTH = 390;

function FeedProviders({ children }: PropsWithChildren) {
  return (
    <StaticDIProvider
      container={createTestDi({
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      })}
    >
      <LocalDateProvider>{children}</LocalDateProvider>
    </StaticDIProvider>
  );
}

function useFeedScreen() {
  const [selectedDateKey, setSelectedDateKey] = useFeedDateKey();
  const [friendId, selectFriend] = useFeedFriendId();
  const [action] = useFeedAction();
  const [selectedTodoId, setSelectedTodoId] = useFeedSelectedTodoId();

  return {
    selectedDateKey,
    setSelectedDateKey,
    friendId,
    selectFriend,
    action,
    selectedTodoId,
    setSelectedTodoId,
  };
}

function renderFeed(url: string, options: { from?: string; routes?: string[] } = {}) {
  return renderRouteHook(useFeedScreen, { url, wrapper: FeedProviders, ...options });
}

const FIXED_NOW = new Date(2026, 10, 8, 12);

describe('피드 URL 플로우', () => {
  // 날짜만 고정한다. 타이머·프레임은 실제로 돌아 route 이동이 끝까지 간다
  setupFakeTimersPerTest({
    now: FIXED_NOW,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });

  beforeEach(() => {
    stubWindowDimensions(FOLD_WIDTH);
  });

  describe('날짜', () => {
    it('다른 날을 고르면 ?date가 생기고 오늘을 고르면 사라진다', async () => {
      // Given
      const feed = await renderFeed('/feed');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // When
      await feed.run(({ setSelectedDateKey }) => setSelectedDateKey(toKey(tomorrow)));
      const pickedUrl = feed.url();
      await feed.run(({ setSelectedDateKey }) => setSelectedDateKey(toKey(new Date())));

      // Then
      expect(pickedUrl).toBe(`/feed?date=${toKey(tomorrow)}`);
      expect(feed.url()).toBe('/feed');
    });

    it('날짜를 바꿔도 폴드에서 고른 할 일 칸과 정렬은 그대로다', async () => {
      // Given
      const feed = await renderFeed('/feed?todoId=5&sort=POPULAR');
      // When
      await feed.run(({ setSelectedDateKey }) => setSelectedDateKey(createDateKey('2030-01-02')));

      // Then
      expect(feed.hook().selectedTodoId).toBe(5);
      expect(feed.url()).toBe('/feed?todoId=5&sort=POPULAR&date=2030-01-02');
    });
  });

  describe('친구', () => {
    it('친구를 바꾸면 날짜는 남고 고른 할 일과 댓글 위치가 사라진다', async () => {
      // Given
      const feed = await renderFeed(
        `/feed?date=2030-01-02&todoId=5&comment=${COMMENT}&sort=POPULAR`,
      );

      // When
      await feed.run(({ selectFriend }) => selectFriend(FRIEND));

      // Then
      expect(feed.hook().friendId).toBe(FRIEND);
      expect(feed.hook().selectedTodoId).toBeUndefined();
      expect(feed.hook().selectedDateKey).toBe('2030-01-02');
      expect(feed.url()).toBe(`/feed?date=2030-01-02&friendId=${FRIEND}`);
    });
  });

  describe('뒤로 가기', () => {
    it('같은 화면 안의 값 변경은 기록을 쌓지 않아 뒤로 가기 한 번에 앞 화면으로 간다', async () => {
      // Given
      const feed = await renderFeed('/feed', { from: '/mypage' });

      // When
      await feed.run(({ setSelectedDateKey }) => setSelectedDateKey(createDateKey('2030-01-02')));
      await feed.run(({ selectFriend }) => selectFriend(FRIEND));
      await feed.run(({ setSelectedTodoId }) => setSelectedTodoId(5));
      await act(async () => router.back());

      // Then
      expect(feed.url()).toBe('/mypage');
    });
  });

  describe('다른 화면이 보낸 할 일 추가 요청', () => {
    it('위 화면을 닫고 피드로 오면 날짜·친구·고른 할 일을 지워 오늘의 내 피드에서 요청을 받는다', async () => {
      // Given
      const feed = await renderFeed(
        `/feed?date=2030-01-02&friendId=${FRIEND}&todoId=5&comment=${COMMENT}`,
        { routes: ['whats-new'] },
      );
      await act(async () => router.push('/whats-new'));

      // When
      await act(async () =>
        router.dismissTo({ pathname: '/feed', params: { action: 'add-voice-todo' } }),
      );

      // Then
      expect(feed.url()).toBe('/feed?action=add-voice-todo');
      expect(feed.hook()).toMatchObject({
        selectedDateKey: toKey(new Date()),
        friendId: undefined,
        selectedTodoId: undefined,
        action: 'add-voice-todo',
      });
    });
  });

  describe('폴드 접고 펴기', () => {
    it('고른 할 일이 있는 채로 접히면 상세로 넘어가고, 뒤로 오면 다시 열리지 않는다', async () => {
      // Given
      stubWindowDimensions(PHONE_WIDTH);
      const feed = await renderRouteHook(
        () => {
          useFeedTodoDetailHandoff();
          return useFeedSelectedTodoId();
        },
        {
          url: `/feed?todoId=5&comment=${COMMENT}&sort=POPULAR`,
          from: '/mypage',
          routes: ['todo/[todoId]'],
        },
      );

      // Then
      expect(feed.url()).toBe(`/todo/5?sort=POPULAR&comment=${COMMENT}`);

      // When
      await act(async () => router.back());

      // Then
      expect(feed.url()).toBe('/feed');
    });

    it('접힌 화면에서 할 일을 고르면 상세 화면을 쌓고 피드 URL은 그대로다', async () => {
      // Given
      stubWindowDimensions(PHONE_WIDTH);
      const feed = await renderFeed('/feed?date=2030-01-02', { routes: ['todo/[todoId]'] });

      // When
      await feed.run(({ setSelectedTodoId }) => setSelectedTodoId(7));

      // Then
      expect(feed.url()).toBe('/todo/7');

      // When
      await act(async () => router.back());

      // Then
      expect(feed.url()).toBe('/feed?date=2030-01-02');
    });
  });

  describe('딥링크로 읽기', () => {
    it('모든 값이 있는 링크를 그대로 읽는다', async () => {
      // When
      const feed = await renderFeed(
        `/feed?date=2030-01-02&friendId=${FRIEND}&todoId=5&action=add-todo&comment=${COMMENT}&sort=POPULAR`,
      );

      // Then
      expect(feed.hook()).toMatchObject({
        selectedDateKey: '2030-01-02',
        friendId: FRIEND,
        selectedTodoId: 5,
        action: 'add-todo',
      });
    });

    it.each([
      ['잘못된 값', '/feed?date=tomorrow&friendId=abc&todoId=0&action=delete-all'],
      ['빈 값', '/feed?date=&friendId=&todoId=&action='],
      ['반복 키', '/feed?todoId=1&todoId=2&date=2030-01-02&date=2030-01-03'],
      ['옛 링크의 지운 키', '/feed?intent=reply&returnTo=overview'],
    ])('%s은 오늘의 내 피드로 읽는다', async (_name, url) => {
      // When
      const feed = await renderFeed(url);

      // Then
      expect(feed.hook()).toMatchObject({
        friendId: undefined,
        selectedTodoId: undefined,
        action: undefined,
      });
      expect(feed.hook().selectedDateKey).toBe(toKey(new Date()));
    });

    it('?date=today는 오늘로 읽고 앱이 다른 날을 고를 때까지 URL을 건드리지 않는다', async () => {
      // When
      const feed = await renderFeed('/feed?date=today');

      // Then
      expect(feed.hook().selectedDateKey).toBe(toKey(new Date()));
      expect(feed.url()).toBe('/feed?date=today');
    });
  });
});

function toKey(date: Date): DateKey {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return createDateKey(`${date.getFullYear()}-${month}-${day}`);
}
