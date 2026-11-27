import {
  type Todo as TodoDto,
  type TodoSummaryResponse,
  todoSummaryResponseSchema,
} from '@aido/api/contracts/todo/v1';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createFriendsListDto } from '@src/features/social/friend/__tests__/friend.fixtures';
import { createHttpClientStub, respondByPath } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { fireEvent, screen } from '@testing-library/react-native';

import { createTodoDto, createTodoListResponseDto } from './todo.fixtures';

/** 수요일. 그 주는 11월 8일(일)~14일(토)이다 */
export const TODAY = createDateKey('2026-11-11');
export const TODAY_NOON = new Date(2026, 10, 11, 12);

type GetResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

interface TodoServerOptions {
  /** 날짜(YYYY-MM-DD)마다 서버가 가진 내 할 일 */
  todosByDate?: Record<string, TodoDto[]>;
  /** path마다 덮어쓰는 GET 응답 */
  get?: Record<string, GetResponse>;
}

/** 할 일 화면들이 읽는 서버. 정하지 않은 조회는 빈 데이터의 무료 사용자다 */
export function createTodoServer({ todosByDate = {}, get = {} }: TodoServerOptions = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation((path: string, config?: RequestConfig) => {
    const params = config?.params ?? {};
    return respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/auth/preference': ok(createPreferenceDto()),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/notifications/inbox/unread-count': ok({ unreadCount: 0 }),
      'v1/invites/availability': ok({ enabled: false }),
      'v1/follows/friends': ok(createFriendsListDto({ friends: [], totalCount: 0 })),
      'v1/todo-categories': ok(createTodoCategoryListDto()),
      'v1/todos': ok(
        createTodoListResponseDto({ items: todosByDate[String(params.startDate)] ?? [] }),
      ),
      'v1/todos/overview': ok({ hasTodo: true, hasCompletedTodo: true, hasActiveRepeat: false }),
      'v1/todos/summary': ok(createTodoSummaryDto({ date: String(params.date) })),
      'v1/daily-completions': ok({
        completions: [],
        totalCompleteDays: 0,
        dateRange: { startDate: params.startDate, endDate: params.endDate },
      }),
      ...get,
    })(path);
  });

  return httpClient;
}

/** 기기 시간대와 상관없이 오늘 저녁 6시다 */
const TODAY_6PM = new Date(2026, 10, 11, 18).toISOString();

/** 운동(기본 카테고리)·회의(업무 카테고리) 두 할 일. 둘 다 오늘 저녁 6시다 */
export const WORKOUT = createTodoDto({
  id: 1,
  title: '운동',
  startDate: TODAY,
  scheduledTime: TODAY_6PM,
});
export const MEETING = createTodoDto({
  id: 2,
  title: '회의',
  startDate: TODAY,
  scheduledTime: TODAY_6PM,
  sortOrder: 1,
  category: { id: 2, name: '업무', color: '#EF4444', sortOrder: 1 },
});

export function createTodoSummaryDto(overrides: Partial<TodoSummaryResponse> = {}) {
  return todoSummaryResponseSchema.parse({
    date: TODAY,
    totalTodos: 2,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
    ...overrides,
  });
}

type HostNode = ReturnType<typeof screen.getByTestId>;

/** 화면에 그려진 글자를 위에서 아래 순서로 읽는다. 묶음의 순서를 볼 때 쓴다 */
export function getShownTexts(): string[] {
  const texts: string[] = [];
  const visit = (node: HostNode) => {
    for (const child of node.children) {
      if (typeof child === 'string') {
        texts.push(child);
      } else {
        visit(child);
      }
    }
  };
  if (screen.root != null) {
    visit(screen.root);
  }
  return texts;
}

/** 네이티브 목록·새로고침처럼 누를 수 없는 부품은 그 prop을 가진 host로 찾는다 */
export function findHostsWithProp(propName: string): HostNode[] {
  const found: HostNode[] = [];
  const visit = (node: HostNode) => {
    if (node.props[propName] != null) {
      found.push(node);
    }
    for (const child of node.children) {
      if (typeof child !== 'string') {
        visit(child);
      }
    }
  };
  if (screen.root != null) {
    visit(screen.root);
  }
  return found;
}

/** 시트 route는 모달이 크기를 받은 뒤 내용을 그린다. 그린 직후 화면 크기를 알려 준다 */
export async function layoutSheetRoute() {
  const [layoutHost] = findHostsWithProp('onLayout');
  if (layoutHost != null) {
    await fireEvent(layoutHost, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }
}

/** 보낸 GET을 path마다 센다 */
export function countGetRequests(httpClient: jest.Mocked<HttpClient>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [path] of httpClient.get.mock.calls) {
    counts[path] = (counts[path] ?? 0) + 1;
  }
  return counts;
}
