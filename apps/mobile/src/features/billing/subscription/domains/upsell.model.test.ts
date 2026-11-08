import { UpsellPolicy } from './upsell.model';

describe('getPromptSurface', () => {
  it.each([
    ['닫은 적이 없으면', null, 'sheet'],
    ['어제 닫았으면', '2026-11-08', 'sheet'],
    ['오늘 닫았으면', '2026-11-09', 'toast'],
  ] as const)('%s %s로 알린다', (_case, dismissedOn, surface) => {
    // Given
    const todayKey = '2026-11-09';

    // When
    const result = UpsellPolicy.getPromptSurface(dismissedOn, todayKey, {
      hasAlternativeAction: false,
    });

    // Then
    expect(result).toBe(surface);
  });

  it('대안 동작이 있으면 오늘 닫았어도 시트로 알린다', () => {
    // Given
    const todayKey = '2026-11-09';

    // When
    const result = UpsellPolicy.getPromptSurface(todayKey, todayKey, {
      hasAlternativeAction: true,
    });

    // Then
    expect(result).toBe('sheet');
  });
});

describe('excludeBlockedBenefit', () => {
  const benefits = [
    { feature: 'AI_PARSE' },
    { feature: 'CUSTOM_REMINDER_TIME' },
    { feature: 'NUDGE' },
    { feature: 'APP_ICON' },
  ] as const;

  it('막힌 기능은 빼고 나머지 순서는 그대로 둔다', () => {
    // When
    const visible = UpsellPolicy.excludeBlockedBenefit(benefits, 'NUDGE');

    // Then
    expect(visible.map(({ feature }) => feature)).toEqual([
      'AI_PARSE',
      'CUSTOM_REMINDER_TIME',
      'APP_ICON',
    ]);
  });

  it.each([
    ['막힌 기능을 모르면', undefined],
    ['목록에 없는 기능이면', 'FRIEND'],
  ] as const)('%s 모두 보여 준다', (_case, feature) => {
    // When
    const visible = UpsellPolicy.excludeBlockedBenefit(benefits, feature);

    // Then
    expect(visible).toEqual(benefits);
  });
});
