import { BENEFIT_SLIDES } from '../constants/subscription.constants';
import { getInitialBenefitIndex, hasBenefitSlide } from './benefit-slides.view-model';

describe('getInitialBenefitIndex', () => {
  it.each([
    ['막힌 기능 없이 들어오면 첫 장', undefined, 0],
    ['AI 리포트에서 막혔으면 그 장', 'AI_REPORT', 1],
    ['말로 메모하기에서 막혔으면 마지막 장', 'VOICE_NOTE', 3],
    ['혜택 장에 없는 친구 한도면 첫 장', 'FRIEND', 0],
  ] as const)('%s부터 보여 준다', (_case, feature, expected) => {
    // When
    const index = getInitialBenefitIndex(BENEFIT_SLIDES, feature);

    // Then
    expect(index).toBe(expected);
  });
});

describe('hasBenefitSlide', () => {
  it.each([
    ['AI 할 일 만들기', 'AI_PARSE', true],
    ['카테고리', 'TODO_CATEGORY', false],
  ] as const)('%s 혜택 장이 있는지 알려 준다', (_case, feature, expected) => {
    // When
    const hasSlide = hasBenefitSlide(BENEFIT_SLIDES, feature);

    // Then
    expect(hasSlide).toBe(expected);
  });
});
