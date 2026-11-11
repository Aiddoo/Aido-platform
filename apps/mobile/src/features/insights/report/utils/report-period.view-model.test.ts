import { i18n } from '@src/shared/i18n';

import { formatReportPeriodLabel } from './report-period.view-model';

const KO = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;
const EN = { locale: 'en-US', timeZone: 'Asia/Seoul' } as const;

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('formatReportPeriodLabel', () => {
  it('주간 리포트 기간을 앱 언어로 만든다', () => {
    // Given
    const report = { type: 'WEEKLY', year: 2026, period: 10 } as const;

    // When
    const korean = formatReportPeriodLabel(report, KO);
    const english = formatReportPeriodLabel(report, EN);

    // Then
    expect(korean).toBe('2026년 10주차');
    expect(english).toBe('Week 10, 2026');
  });

  it('월간 리포트 기간을 앱 언어로 만든다', () => {
    // Given
    const report = { type: 'MONTHLY', year: 2026, period: 3 } as const;

    // When
    const korean = formatReportPeriodLabel(report, KO);
    const english = formatReportPeriodLabel(report, EN);

    // Then
    expect(korean).toBe('2026년 3월');
    expect(english).toBe('March 2026');
  });
});
