import { aiReportIdParamSchema, weeklyAchievementParamSchema } from '@aido/api';
import { isSampleReportId, getSampleReport } from '@src/features/ai/constants/sample-reports';

import { routeIntegerStringSchema } from './route-params';

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
});
