import { subscriptionParamsSchema } from './subscription-params.schema';

describe('subscriptionParamsSchema', () => {
  it.each([
    ['아무 값이 없으면 상태 화면', {}, { view: 'status', feature: undefined, plan: undefined }],
    [
      '요금제 화면과 막힌 기능',
      { view: 'plans', feature: 'AI_PARSE', plan: 'annual' },
      { view: 'plans', feature: 'AI_PARSE', plan: 'annual' },
    ],
    [
      '모르는 보기·기능·빈 요금제는 기본값으로',
      { view: 'checkout', feature: 'TELEPATHY', plan: '' },
      { view: 'status', feature: undefined, plan: undefined },
    ],
  ])('%s', (_case, params, expected) => {
    // When
    const result = subscriptionParamsSchema.parse(params);

    // Then
    expect(result).toEqual(expected);
  });
});
