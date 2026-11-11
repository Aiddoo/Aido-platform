import { useSubscriptionParams } from '@src/features/billing/subscription/hooks/use-subscription-params';
import { useTodoCommentSort } from '@src/features/engagement/comment/hooks/use-todo-comment-params';
import { useReportType } from '@src/features/insights/report/hooks/use-report-type';
import { useSelectedMemoId } from '@src/features/notes/memo/hooks/use-memo-params';
import { useNotificationCategory } from '@src/features/notification/hooks/use-notification-params';
import { notificationDirectionParamSchema } from '@src/features/notification/schemas/notification-params.schema';
import { categorySettingsViewSchema } from '@src/features/planning/category/schemas/category-settings-params.schema';
import { useFeedAction, useFeedFriendId } from '@src/features/planning/todo/hooks/use-feed-params';
import { useFeedSelectedTodoId } from '@src/features/planning/todo/hooks/use-feed-selected-todo-id';
import {
  useFriendListIsEditing,
  useFriendListView,
} from '@src/features/social/friend/hooks/use-friend-list-params';
import { useInvitedFriendsView } from '@src/features/social/invite/hooks/use-invited-friends-view';
import { voiceNoteTabSchema } from '@src/features/voice/schemas/voice-note-params.schema';
import { useWeatherRescheduleParams } from '@src/features/weather/hooks/use-weather-reschedule-params';
import { useView } from '@src/shared/hooks/use-view';
import { stubWindowDimensions } from '@src/testing/core';
import { renderRouteHook } from '@src/testing/render-route-hook';

jest.unmock('expo-router');

const COMMENT = 'cmt92zn3n000b7voxx9quc2th';
const FRIEND = 'cmfriend000000000000000001';
const FOLD_WIDTH = 900;
const STRANGER_DRAFT = '11111111-1111-4111-8111-111111111111';

/** 앱 밖 링크와 저장된 알림이 쓰는 주소다. 값이 하나라도 바뀌면 옛 링크가 다르게 열린다 */
describe('공개 URL 계약', () => {
  beforeEach(() => {
    stubWindowDimensions(FOLD_WIDTH);
  });

  it.each([
    [
      '다른 친구를 고르면 날짜만 남는다',
      `/feed?date=2026-07-20&todoId=5&comment=${COMMENT}&sort=POPULAR&action=add-todo`,
      `/feed?date=2026-07-20&friendId=${FRIEND}`,
      FRIEND,
    ],
    [
      '나를 고르면 friendId가 사라진다',
      `/feed?friendId=${FRIEND}&date=2026-07-20&todoId=5`,
      '/feed?date=2026-07-20',
      undefined,
    ],
  ])('피드 친구: %s', async (_name, url, expected, friend) => {
    // Given
    const route = await renderRouteHook(() => useFeedFriendId(), { url });

    // When
    await route.run(([_friendId, selectFriend]) => selectFriend(friend));

    // Then
    expect(route.url()).toBe(expected);
  });

  it('피드 요청: 처리하면 action만 사라진다', async () => {
    // Given
    const route = await renderRouteHook(() => useFeedAction(), {
      url: '/feed?action=add-todo&date=2026-07-20',
    });

    // When
    await route.run(([_action, setAction]) => setAction(undefined));

    // Then
    expect(route.url()).toBe('/feed?date=2026-07-20');
  });

  it.each([
    ['고르기', '/feed?date=2026-07-20', 7, '/feed?date=2026-07-20&todoId=7'],
    [
      '다른 할 일로 바꾸면 댓글 위치와 정렬이 사라진다',
      `/feed?todoId=5&comment=${COMMENT}&sort=POPULAR&date=2026-07-20`,
      7,
      '/feed?todoId=7&date=2026-07-20',
    ],
    ['칸 닫기', `/feed?todoId=5&comment=${COMMENT}&sort=POPULAR`, undefined, '/feed'],
    [
      '같은 할 일을 다시 누르면 그대로다',
      `/feed?todoId=5&comment=${COMMENT}&sort=POPULAR`,
      5,
      `/feed?todoId=5&comment=${COMMENT}&sort=POPULAR`,
    ],
  ])('폴드 할 일 칸: %s', async (_name, url, todoId, expected) => {
    // Given
    const route = await renderRouteHook(() => useFeedSelectedTodoId(), { url });

    // When
    await route.run(([_todoId, setSelectedTodoId]) => setSelectedTodoId(todoId));

    // Then
    expect(route.url()).toBe(expected);
  });

  it.each([
    ['고르기', '/memo', 5, '/memo?memoId=5'],
    ['닫기', '/memo?memoId=5', undefined, '/memo'],
  ])('폴드 메모 칸: %s', async (_name, url, memoId, expected) => {
    // Given
    const route = await renderRouteHook(() => useSelectedMemoId(), { url });

    // When
    await route.run(([_memoId, setSelectedMemoId]) => setSelectedMemoId(memoId));

    // Then
    expect(route.url()).toBe(expected);
  });

  it('댓글: 정렬을 바꾸면 알림으로 연 위치가 사라진다', async () => {
    // Given
    const route = await renderRouteHook(() => useTodoCommentSort(), {
      url: `/feed?sort=LATEST&comment=${COMMENT}`,
    });

    // When
    await route.run(([_sort, setSort]) => setSort('POPULAR'));

    // Then
    expect(route.url()).toBe('/feed?sort=POPULAR');
  });

  it('날씨 옮기기: 할 일을 빼면 쉼표 목록이 줄고 reason은 남는다', async () => {
    // Given
    const route = await renderRouteHook(() => useWeatherRescheduleParams(), {
      url: '/weather/reschedule?todoIds=12,15,18&reason=heat',
    });

    // When
    await route.run(([_values, setParams]) => setParams({ todoIds: [12, 18] }));

    // Then
    expect(route.url()).toBe('/weather/reschedule?todoIds=12%2C18&reason=heat');
  });

  it.each([
    ['켜면 true', '/friends', true, '/friends?isEditing=true'],
    ['끄면 값이 사라진다', '/friends?isEditing=true', false, '/friends'],
  ])('친구 편집: %s', async (_name, url, next, expected) => {
    // Given
    const route = await renderRouteHook(() => useFriendListIsEditing(), { url });

    // When
    await route.run(([_isEditMode, setIsEditMode]) => setIsEditMode(next));

    // Then
    expect(route.url()).toBe(expected);
  });

  it('탭 값은 ?키=값 그대로 쓴다', async () => {
    // Given
    const friends = await renderRouteHook(() => useFriendListView(), { url: '/friends' });

    // When
    await friends.run(([_view, setView]) => setView('receiver'));

    // Then
    expect(friends.url()).toBe('/friends?view=receiver');
  });

  it('알림 분류', async () => {
    // Given
    const route = await renderRouteHook(() => useNotificationCategory(), {
      url: '/notifications',
    });

    // When
    await route.run(([_category, setCategory]) => setCategory('ALL'));

    // Then
    expect(route.url()).toBe('/notifications?category=ALL');
  });

  it('알림 방향', async () => {
    // Given
    const route = await renderRouteHook(
      () => useView('direction', notificationDirectionParamSchema),
      {
        url: '/notifications',
      },
    );

    // When
    await route.run(([_direction, setDirection]) => setDirection('sent'));

    // Then
    expect(route.url()).toBe('/notifications?direction=sent');
  });

  it.each([
    ['/notifications?category=SOCIAL&direction=sent', 'SOCIAL', 'sent'],
    ['/notifications', 'ALL', 'received'],
    ['/notifications?category=UNKNOWN&direction=unknown', 'ALL', 'received'],
  ])('알림 링크 %s는 분류 %s, 방향 %s로 연다', async (url, category, direction) => {
    // When
    const route = await renderRouteHook(
      () => [
        useNotificationCategory()[0],
        useView('direction', notificationDirectionParamSchema)[0],
      ],
      { url },
    );

    // Then
    expect(route.hook()).toEqual([category, direction]);
  });

  it('초대한 친구 보기', async () => {
    // Given
    const route = await renderRouteHook(() => useInvitedFriendsView(), {
      url: '/invitees',
    });

    // When
    await route.run(([_view, setView]) => setView('waiting'));

    // Then
    expect(route.url()).toBe('/invitees?view=waiting');
  });

  it.each([
    ['/subscription?view=plans', { view: 'plans', feature: undefined }],
    ['/subscription', { view: 'status', feature: undefined }],
    ['/subscription?view=unknown', { view: 'status', feature: undefined }],
    ['/subscription?feature=AI_PARSE', { view: 'status', feature: 'AI_PARSE' }],
    ['/subscription?feature=UNKNOWN', { view: 'status', feature: undefined }],
  ])('구독 화면 값: %s는 %o로 읽는다', async (url, expected) => {
    // When
    const route = await renderRouteHook(() => useSubscriptionParams(), { url });

    // Then
    expect(route.hook()[0]).toEqual(expected);
  });

  it('리포트 종류', async () => {
    // Given
    const route = await renderRouteHook(() => useReportType(), { url: '/reports' });

    // When
    await route.run(([_type, setType]) => setType('MONTHLY'));

    // Then
    expect(route.url()).toBe('/reports?type=MONTHLY');
  });

  it('카테고리 설정 보기', async () => {
    // Given
    const route = await renderRouteHook(() => useView('view', categorySettingsViewSchema), {
      url: '/category-settings',
    });

    // When
    await route.run(([_view, setView]) => setView('reorder'));

    // Then
    expect(route.url()).toBe('/category-settings?view=reorder');
  });

  it('음성 메모 탭', async () => {
    // Given
    const route = await renderRouteHook(() => useView('tab', voiceNoteTabSchema), {
      url: `/voice-note?draftId=${STRANGER_DRAFT}`,
    });

    // When
    await route.run(([_tab, setTab]) => setTab('todos'));

    // Then
    expect(route.url()).toBe(`/voice-note?draftId=${STRANGER_DRAFT}&tab=todos`);
  });
});
