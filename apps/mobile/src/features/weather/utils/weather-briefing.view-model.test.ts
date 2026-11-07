import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';

import {
  createBriefingTodo,
  createHourlySeries,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { type BriefingTodo, WeatherBriefingPolicy } from '../domains/weather-briefing.model';
import {
  type BriefingViewDeps,
  toBriefingState,
  toBriefingView,
} from './weather-briefing.view-model';

/** 서울 15:26. 16~17시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const report = createWeatherReport({
  fetchedAt: '2026-11-02T06:20:00.000Z',
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});

const DEPS: BriefingViewDeps = {
  hourly: report.hourly,
  now: NOW,
  timeZone: 'Asia/Seoul',
  formatClock: (date) => `clock:${date}`,
  formatHour: (date) => `hour:${date}`,
  formatDegrees: (celsius) => `${celsius}°`,
  formatChance: (percent) => `${percent}%`,
};

function viewFor(todos: BriefingTodo[]) {
  const briefing = WeatherBriefingPolicy.getWeatherBriefing(report, todos, {
    now: NOW,
    timeZone: 'Asia/Seoul',
  });
  return toBriefingView(briefing, DEPS);
}

describe('toBriefingState', () => {
  it('리포트를 받기 전이거나 받지 못했으면 자리만 잡고 실패는 리포트 경계에 맡긴다', () => {
    // When
    const state = toBriefingState(undefined, { now: NOW, deviceTimeZone: 'Asia/Seoul' });

    // Then
    expect(state).toBe('loading');
  });

  it('6시간 넘게 갱신되지 않은 리포트로는 브리핑하지 않는다', () => {
    // Given
    const later = fromEpochMs(toEpochMs(NOW) + 7 * 60 * 60_000);

    // When
    const state = toBriefingState(report, { now: later, deviceTimeZone: 'Asia/Seoul' });

    // Then
    expect(state).toBe('hidden');
  });

  it.each([
    ['Asia/Tokyo', 'visible'],
    ['America/Los_Angeles', 'hidden'],
  ] as const)('기기 시간대가 %s이면 서울 리포트 브리핑은 %s이다', (deviceTimeZone, expected) => {
    // When
    const state = toBriefingState(report, { now: NOW, deviceTimeZone });

    // Then
    expect(state).toBe(expected);
  });
});

describe('toBriefingView', () => {
  it('비와 겹치는 할 일 하나는 제목을 넣어 알리고, 마른 시각과 강수 확률을 행에 보인다', () => {
    // When
    const view = viewFor([createBriefingTodo()]);

    // Then
    expect(view.headline).toEqual({ key: 'briefing.rainyOne', values: { title: '산책' } });
    expect(view.rows[0]).toMatchObject({
      tone: 'warning',
      chipCondition: 'RAIN',
      chipLabel: '70%',
      advice: { key: 'briefing.dryAt' },
    });
    expect(view.action).toMatchObject({ kind: 'reschedule', reason: 'rain', todoIds: [1] });
  });

  it('비와 겹친 할 일을 모두 끝냈으면 옮기기 버튼을 감춘다', () => {
    // When
    const view = viewFor([createBriefingTodo({ completed: true })]);

    // Then
    expect(view.rows).toHaveLength(1);
    expect(view.action).toBeNull();
  });

  it('할 일이 없고 오늘 늦게 비가 오면 비 시작 시각만 알리고 할 일 제안은 하지 않는다', () => {
    // When
    const view = viewFor([]);

    // Then
    expect(view.body).toEqual({
      key: 'briefing.rainLater.todayBody',
      values: { time: 'hour:2026-11-02T07:00:00.000Z' },
    });
    expect(view.rows).toEqual([]);
    expect(view.action).toBeNull();
  });
});
