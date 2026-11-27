import { toInstant } from '@src/shared/date/instant';

import {
  createBriefingDto,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import {
  filterByUpcomingOption,
  type WeatherReportBriefing,
  WeatherReportBriefingPolicy,
} from './weather-report-briefing.model';

const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);

function createReportBriefing(
  overrides: Parameters<typeof createBriefingDto>[0],
): WeatherReportBriefing {
  const { briefing } = createWeatherReport({
    hourly: HOURLY,
    briefing: createBriefingDto(overrides),
  });
  if (briefing == null) {
    throw new Error('서버 브리핑을 만들지 못했다');
  }
  return briefing;
}

/** 서버가 16:30 할 일 1만 비와 겹친다고 보고 19시·21시를 후보로 고른다 */
const BRIEFING = createReportBriefing({
  reason: 'rain',
  affectedTodoIds: [1],
  rescheduleOptions: [
    {
      todoId: 1,
      options: [
        createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { isRecommended: true }),
        createRescheduleOptionDto('2026-11-02T12:00:00.000Z'),
      ],
    },
  ],
});

describe('filterByUpcomingOption', () => {
  it('리포트를 받은 뒤 정시를 넘겨 지난 후보는 빼고 서버 순서를 지킨다', () => {
    // Given
    const options = WeatherReportBriefingPolicy.getOptions(BRIEFING, 1);
    const now = toInstant('2026-11-02T10:00:00.000Z');

    // When
    const upcoming = options.filter((option) => filterByUpcomingOption(option, now));

    // Then
    expect(upcoming.map((option) => option.startsAt)).toEqual(['2026-11-02T12:00:00.000Z']);
  });
});

describe('WeatherReportBriefingPolicy', () => {
  describe('getOptions', () => {
    it('서버가 후보 줄을 주지 않은 할 일은 옮길 시각이 없다', () => {
      // When
      const options = WeatherReportBriefingPolicy.getOptions(BRIEFING, 2);

      // Then
      expect(options).toEqual([]);
    });
  });

  describe('findNextOption', () => {
    it('지난 선택을 바꿀 다음 후보는 그 할 일의 아직 지나지 않은 첫 서버 후보다', () => {
      // When
      const next = WeatherReportBriefingPolicy.findNextOption(
        BRIEFING,
        1,
        toInstant('2026-11-02T10:00:30.000Z'),
      );

      // Then
      expect(next?.startsAt).toBe('2026-11-02T12:00:00.000Z');
    });

    it.each([
      { title: '서버 후보가 모두 지났으면', todoId: 1, now: '2026-11-02T12:00:30.000Z' },
      { title: '서버 후보가 없는 할 일이면', todoId: 2, now: '2026-11-02T06:26:00.000Z' },
    ])('$title 바꿀 후보가 없다', ({ todoId, now }) => {
      // When
      const next = WeatherReportBriefingPolicy.findNextOption(BRIEFING, todoId, toInstant(now));

      // Then
      expect(next).toBeNull();
    });
  });
});
