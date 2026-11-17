import { aiReportIdParamSchema, weeklyAchievementParamSchema } from '@aido/api';
import { z } from 'zod';

import { routeIdSchema, routeIntegerStringSchema } from './route-params.schema';

const reportIdSchema = routeIntegerStringSchema.pipe(aiReportIdParamSchema.shape.id);
const weekSchema = routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.week);

describe('route params', () => {
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
