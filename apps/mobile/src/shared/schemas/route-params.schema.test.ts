import { aiReportIdParamSchema, weeklyAchievementParamSchema } from '@aido/api';
import { isSampleReportId } from '@src/features/insights/report/constants/sample-reports.constants';
import { z } from 'zod';

import { routeIdSchema, routeIntegerStringSchema } from './route-params.schema';

const reportIdSchema = routeIntegerStringSchema.pipe(aiReportIdParamSchema.shape.id);
const weekSchema = routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.week);

describe('route params', () => {
  it.each(['toString', '__proto__', 'constructor'])(
    '샘플 ID가 아닌 프로토타입 이름 %s를 거부한다',
    (id) => {
      // When
      const isSample = isSampleReportId(id);

      // Then
      expect(isSample).toBe(false);
    },
  );

  it('등록된 샘플 ID만 허용한다', () => {
    // When
    const isWeeklySample = isSampleReportId('sample-weekly');
    const isMonthlySample = isSampleReportId('sample-monthly');

    // Then
    expect(isWeeklySample).toBe(true);
    expect(isMonthlySample).toBe(true);
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
    // When
    const result = reportIdSchema.safeParse(value);

    // Then
    expect(result.success).toBe(false);
  });

  it('검증된 ID는 서버 계약의 숫자로 변환한다', () => {
    // When
    const reportId = reportIdSchema.parse('42');
    const tooLargeWeek = weekSchema.safeParse('54');
    const lastWeek = weekSchema.parse('53');

    // Then
    expect(reportId).toBe(42);
    expect(tooLargeWeek.success).toBe(false);
    expect(lastWeek).toBe(53);
  });
});

describe('routeIdSchema', () => {
  it.each([
    { value: '12', expected: 12 },
    { value: '0', expected: undefined },
    { value: '-1', expected: undefined },
    { value: '1.5', expected: undefined },
    { value: 'abc', expected: undefined },
    { value: '99999999999999999999', expected: undefined },
  ])('$value는 $expected로 읽는다', ({ value, expected }) => {
    // Given
    const param = value;

    // When
    const result = routeIdSchema.safeParse(param);

    // Then
    expect(result.data).toBe(expected);
  });

  it('쓸 때는 URL 형식인 문자열로 되돌린다', () => {
    // When
    const encoded = z.encode(routeIdSchema, 12);

    // Then
    expect(encoded).toBe('12');
  });
});
