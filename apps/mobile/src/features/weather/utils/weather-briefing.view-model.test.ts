import { toInstant } from '@src/shared/date/instant';

import {
  createBriefingDto,
  createBriefingTodo,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { type BriefingTodo, findWeatherBriefing } from '../domains/weather-briefing.model';
import type { WeatherReport } from '../domains/weather-report.model';
import { type BriefingViewPorts, toBriefingView } from './weather-briefing.view-model';

/** 서울 15:26. 16~17시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);
/** 서버가 16:30 할 일 1이 비와 겹친다고 보고 19시를 추천한다 */
const rainyReport = createWeatherReport({
  fetchedAt: '2026-11-02T06:20:00.000Z',
  hourly: HOURLY,
  briefing: createBriefingDto({
    reason: 'rain',
    affectedTodoIds: [1],
    rescheduleOptions: [
      {
        todoId: 1,
        options: [createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { isRecommended: true })],
      },
    ],
  }),
  headline: {
    kind: 'todoWet',
    hazard: 'rain',
    precipitationChance: 70,
    window: { startsAt: '2026-11-02T07:00:00.000Z', endsAt: '2026-11-02T09:00:00.000Z' },
  },
});

const DEPS: BriefingViewPorts = {
  hourly: rainyReport.hourly,
  now: NOW,
  formatClock: (date) => `clock:${date}`,
  formatTodoTime: (localTime) => `todo:${localTime}`,
  formatHour: (date) => `hour:${date}`,
  formatTemperature: (celsius) => `${celsius}°`,
  formatChance: (percent) => `${percent}%`,
};

function viewFor(report: WeatherReport, todos: BriefingTodo[]) {
  const briefing = findWeatherBriefing(report, todos, { now: NOW });
  if (briefing == null) {
    throw new Error('서버 브리핑이 있는 리포트여야 한다');
  }
  return toBriefingView(briefing, DEPS);
}

describe('toBriefingView', () => {
  it('비와 겹치는 할 일 하나는 제목을 넣어 알리고, 서버가 추천한 마른 시각과 강수 확률을 행에 보인다', () => {
    // When
    const view = viewFor(rainyReport, [createBriefingTodo()]);

    // Then
    expect(view.headline).toEqual({ key: 'briefing.rainyOne', values: { title: '산책' } });
    expect(view.rows[0]).toMatchObject({
      tone: 'warning',
      chipCondition: 'RAIN',
      chipLabel: '70%',
      advice: { key: 'briefing.dryAt', values: { time: 'clock:2026-11-02T10:00:00.000Z' } },
    });
    expect(view.action).toMatchObject({ kind: 'reschedule', reason: 'rain', todoIds: [1] });
  });

  it('눈 소식 본문의 할 일 시각은 예보 칸을 찾은 순간이 아니라 할 일의 벽시계로 쓴다', () => {
    // Given
    // 서머타임 시작일처럼 없는 02:30이 전환 뒤 순간(16:30 칸)으로 밀린 할 일
    const snowyReport = createWeatherReport({
      hourly: HOURLY,
      briefing: createBriefingDto({ reason: 'rain', affectedTodoIds: [1] }),
      headline: {
        kind: 'todoWet',
        hazard: 'snow',
        precipitationChance: 70,
        window: { startsAt: '2026-11-02T07:00:00.000Z', endsAt: '2026-11-02T09:00:00.000Z' },
      },
    });
    const shiftedTodo = createBriefingTodo({
      localTime: '02:30',
      scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
    });

    // When
    const view = viewFor(snowyReport, [shiftedTodo]);

    // Then
    expect(view.body).toEqual({ key: 'briefing.snowy.body', values: { time: 'todo:02:30' } });
    expect(view.rows[0]?.todo.localTime).toBe('02:30');
  });

  it('비와 겹친 할 일을 모두 끝냈으면 옮기기 버튼을 감춘다', () => {
    // When
    const view = viewFor(rainyReport, [createBriefingTodo({ completed: true })]);

    // Then
    expect(view.rows).toHaveLength(1);
    expect(view.action).toBeNull();
  });

  it('할 일이 없고 오늘 늦게 비가 오면 비 시작 시각만 알리고 할 일 제안은 하지 않는다', () => {
    // Given
    const report = createWeatherReport({
      hourly: HOURLY,
      headline: { kind: 'wetLater', startsAt: '2026-11-02T07:00:00.000Z', isSnow: false },
    });

    // When
    const view = viewFor(report, []);

    // Then
    expect(view.body).toEqual({
      key: 'briefing.rainLater.todayBody',
      values: { time: 'hour:2026-11-02T07:00:00.000Z' },
    });
    expect(view.rows).toEqual([]);
    expect(view.action).toBeNull();
  });

  it('서버가 지금부터 온다고 한 비·눈은 시작 시각 대신 지금 온다고 알린다', () => {
    // Given
    const report = createWeatherReport({
      hourly: HOURLY,
      headline: { kind: 'wetLater', startsAt: '2026-11-02T06:26:00.000Z', isSnow: true },
    });

    // When
    const view = viewFor(report, []);

    // Then
    expect(view.body).toEqual({ key: 'briefing.rainLater.nowSnowBody' });
  });
});
