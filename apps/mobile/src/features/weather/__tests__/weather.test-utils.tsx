import type { Todo as TodoDto } from '@aido/api/contracts/todo/v1';
import { updateWeatherLocationSchema } from '@aido/api/contracts/weather/v2';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { Analytics } from '@src/core/ports/analytics';
import type { HttpClient } from '@src/core/ports/http-client';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { createTodoServer } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { ok } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { Stack } from 'expo-router';

import WeatherScreen from '../../../../app/(app)/weather/index';
import { createWeatherReportDto } from './weather-report.fixtures';

/** 서울 15:26. 기본 리포트(15:20에 받아 15:50까지 유효)를 받은 직후다 */
export const WEATHER_NOW = new Date('2026-11-02T06:26:00.000Z');
export const WEATHER_TODAY = '2026-11-02';
export const REPORT_PATH = 'v2/weather';
export const TODOS_PATH = 'v1/todos';

type Response = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

interface WeatherResponses {
  report?: Response;
  /** 오늘 목록의 할 일. 조회 실패를 보려면 응답을 넘긴다 */
  todos?: readonly TodoDto[] | Response;
}

/** 기본 리포트와 같은 격자(서울 중구)에 있어 위치를 등록해도 리포트를 다시 받지 않는다 */
export function createSeoulLocationStub() {
  return createLocationGatewayStub({
    permission: { status: 'granted', canAskAgain: true },
    coordinates: { latitude: 37.5636, longitude: 126.9976 },
    place: { countryCode: 'KR', name: { city: '서울', district: '중구' } },
  });
}

function isTodoList(todos: WeatherResponses['todos']): todos is readonly TodoDto[] {
  return Array.isArray(todos);
}

/**
 * 날씨 화면·시트가 읽는 조회의 응답을 정한다. 할 일·설정은 할 일 가짜 서버(`createTodoServer`)가 답하고
 * 리포트만 얹는다. 흐름 중간에 다시 불러 다음 응답을 바꾼다
 */
export function respondWeather(
  httpClient: jest.Mocked<HttpClient>,
  { report = ok(createWeatherReportDto()), todos = [] }: WeatherResponses = {},
) {
  const server = createTodoServer({
    todosByDate: isTodoList(todos) ? { [WEATHER_TODAY]: [...todos] } : {},
    get: {
      [REPORT_PATH]: report,
      ...(isTodoList(todos) ? {} : { [TODOS_PATH]: todos }),
    },
  });
  httpClient.get.mockImplementation((path, config) => server.get(path, config));
}

/** 위치 등록은 받은 좌표를 그대로 돌려준다 */
export function createWeatherHttpClient(responses: WeatherResponses = {}) {
  const httpClient = createHttpClientStub();
  httpClient.put.mockImplementation(async (_url, input) => ({
    ok: true,
    value: { ...updateWeatherLocationSchema.parse(input), timezone: 'Asia/Seoul' },
  }));
  respondWeather(httpClient, responses);
  return httpClient;
}

/** 그 이름으로 남긴 분석 이벤트의 값. 사용자 동작 한 번에 한 번만 남는지 본다 */
export function getTrackedEvents(analytics: jest.Mocked<Analytics>, eventName: string) {
  return analytics.trackEvent.mock.calls
    .filter(([name]) => name === eventName)
    .map(([, params]) => params);
}

interface TodayTodoOptions {
  id: number;
  title: string;
  /** 오늘 시작 시각(서울 벽시계 HH:mm) */
  localTime: string;
  completed?: boolean;
}

/** 오늘(서울 11월 2일) 목록의 시각이 정해진 할 일. 서버처럼 벽시계와 그 순간을 함께 준다 */
export function createTodayTodoDto({ id, title, localTime, completed = false }: TodayTodoOptions) {
  return createTodoDto({
    id,
    title,
    startDate: WEATHER_TODAY,
    scheduledLocalTime: localTime,
    scheduledTime: new Date(`${WEATHER_TODAY}T${localTime}:00+09:00`).toISOString(),
    completed,
    completedAt: completed ? '2026-11-02T05:00:00.000Z' : null,
  });
}

interface RenderWeatherScreenOptions {
  httpClient?: jest.Mocked<HttpClient>;
  deviceLocation?: jest.Mocked<LocationGateway>;
  /** 조회 캐시에 미리 넣을 값이 있으면 만든 클라이언트를 넘긴다 */
  queryClient?: ReturnType<typeof createTestQueryClient>;
}

interface RenderedWeatherScreen {
  /** 지금 주소를 읽는다(`getPathname`·`getSearchParams`) */
  route: Awaited<ReturnType<typeof renderAppRoute>>;
  httpClient: jest.Mocked<HttpClient>;
  deviceLocation: jest.Mocked<LocationGateway>;
  analytics: ReturnType<typeof createAnalyticsStub>;
  externalLink: ReturnType<typeof createExternalLinkGatewayStub>;
}

/**
 * 날씨 화면을 진짜 Expo Router에 올린다. 화면이 여는 화면(옮기기 시트·할 일 추가·할 일 메뉴)은 빈 route로 두어
 * 어디로 갔는지를 주소로 본다. 쓰는 테스트 파일은 `jest.unmock('expo-router')`를 부른다
 */
export async function renderWeatherScreen({
  httpClient = createWeatherHttpClient(),
  deviceLocation = createSeoulLocationStub(),
  queryClient = createTestQueryClient(),
}: RenderWeatherScreenOptions = {}): Promise<RenderedWeatherScreen> {
  const analytics = createAnalyticsStub();
  const externalLink = createExternalLinkGatewayStub();
  const route = await renderAppRoute(
    {
      _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
      'weather/index': WeatherScreen,
      'weather/reschedule': () => null,
      'todo/new': () => null,
      'todo/[todoId]/actions': () => null,
    },
    {
      url: '/weather',
      di: createTestDi({
        ports: { httpClient, deviceLocation, analytics, externalLink, queryClient },
      }),
      withLocalDate: true,
      withOverlay: true,
    },
  );
  return { route, httpClient, deviceLocation, analytics, externalLink };
}
