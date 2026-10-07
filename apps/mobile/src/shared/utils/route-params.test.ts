import { aiReportIdParamSchema, weeklyAchievementParamSchema } from '@aido/api';
import {
  isSampleReportId,
  getSampleReport,
} from '@src/features/ai/presentations/constants/sample-reports.constant';

import { parseWebViewUrl, routeIntegerStringSchema } from './route-params';

const reportIdSchema = routeIntegerStringSchema.pipe(aiReportIdParamSchema.shape.id);
const weekSchema = routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.week);

describe('route params', () => {
  it.each(['toString', '__proto__', 'constructor'])(
    '샘플 ID가 아닌 프로토타입 이름 %s를 거부한다',
    (id) => {
      expect(isSampleReportId(id)).toBe(false);
      expect(getSampleReport(id).type).toBe('WEEKLY');
    },
  );

  it('등록된 샘플 ID만 허용한다', () => {
    expect(isSampleReportId('sample-weekly')).toBe(true);
    expect(isSampleReportId('sample-monthly')).toBe(true);
  });

  it.each([
    undefined,
    ['1'],
    ['1', '2'],
    '',
    '0',
    '-1',
    '1.5',
    'NaN',
    '1e2',
    ' 1',
    '9007199254740992',
  ])('잘못된 ID %p를 API 호출 전에 거부한다', (value) => {
    expect(reportIdSchema.safeParse(value).success).toBe(false);
  });

  it('검증된 ID는 서버 계약의 숫자로 변환한다', () => {
    expect(reportIdSchema.parse('42')).toBe(42);
    expect(weekSchema.safeParse('54').success).toBe(false);
    expect(weekSchema.parse('53')).toBe(53);
  });

  it.each([
    undefined,
    ['https://example.com'],
    '%',
    'javascript:alert(1)',
    'file:///tmp/file',
    'not-a-url',
  ])('잘못된 웹뷰 URL %p를 거부한다', (value) => {
    expect(parseWebViewUrl(value)).toBeNull();
  });

  it('이미 디코딩된 URL의 인코딩된 쿼리는 보존한다', () => {
    const url = 'https://example.com/?redirect=%2Ffeed&text=100%25';
    expect(parseWebViewUrl(url)).toBe(url);
  });

  it('이전 호출부의 인코딩된 URL도 지원한다', () => {
    expect(parseWebViewUrl(encodeURIComponent('https://example.com/terms'))).toBe(
      'https://example.com/terms',
    );
  });
});
