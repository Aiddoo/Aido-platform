import { i18n } from '@src/shared/i18n';
import { createDateKey } from '@src/testing/date-key';

import { formatReportPeriodLabel } from './report-period.view-model';

const KO = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;
const EN = { locale: 'en-US', timeZone: 'Asia/Seoul' } as const;
const TODAY_KEY = createDateKey('2026-11-12');

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('formatReportPeriodLabel', () => {
  it('주간 리포트는 ISO 주의 목요일이 속한 달로 센다', () => {
    // Given
    // 2026-W01은 2025-12-29(월)에 시작하지만 목요일이 1월 1일이다
    const report = {
      type: 'WEEKLY',
      dateRange: { startDate: createDateKey('2025-12-29'), endDate: createDateKey('2026-01-04') },
    } as const;

    // When
    const korean = formatReportPeriodLabel(report, TODAY_KEY, KO);
    const english = formatReportPeriodLabel(report, TODAY_KEY, EN);

    // Then
    expect(korean).toBe('1월 1주차');
    expect(english).toBe('Week 1 of Jan');
  });

  it('지난해 주간 리포트는 연도를 붙여 올해 같은 주차와 구별한다', () => {
    // Given
    // 2025-W49(12-01~12-07)를 2026년에 본다
    const report = {
      type: 'WEEKLY',
      dateRange: { startDate: createDateKey('2025-12-01'), endDate: createDateKey('2025-12-07') },
    } as const;

    // When
    const korean = formatReportPeriodLabel(report, TODAY_KEY, KO);
    const english = formatReportPeriodLabel(report, TODAY_KEY, EN);

    // Then
    expect(korean).toBe('2025년 12월 1주차');
    expect(english).toBe('Week 1 of Dec 2025');
  });

  it('월간 리포트 기간을 앱 언어로 만든다', () => {
    // Given
    const report = {
      type: 'MONTHLY',
      dateRange: { startDate: createDateKey('2026-03-01'), endDate: createDateKey('2026-03-31') },
    } as const;

    // When
    const korean = formatReportPeriodLabel(report, TODAY_KEY, KO);
    const english = formatReportPeriodLabel(report, TODAY_KEY, EN);

    // Then
    expect(korean).toBe('2026년 3월');
    expect(english).toBe('March 2026');
  });
});
