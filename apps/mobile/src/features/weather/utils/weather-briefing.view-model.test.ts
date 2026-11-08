import { toInstant } from '@src/shared/date/instant';

import {
  createBriefingTodo,
  createHourlySeries,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { type BriefingTodo, WeatherBriefingPolicy } from '../domains/weather-briefing.model';
import { type BriefingViewDeps, toBriefingView } from './weather-briefing.view-model';

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
  formatTemperature: (celsius) => `${celsius}°`,
  formatChance: (percent) => `${percent}%`,
};

function viewFor(todos: BriefingTodo[]) {
  const briefing = WeatherBriefingPolicy.getWeatherBriefing(report, todos, {
    now: NOW,
    timeZone: 'Asia/Seoul',
  });
  return toBriefingView(briefing, DEPS);
}

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
