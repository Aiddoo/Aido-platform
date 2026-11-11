import { getUpsellPresentation } from './upsell.view-model';

describe('getUpsellPresentation', () => {
  it.each([
    ['닫은 적이 없으면', null, 'sheet'],
    ['어제 닫았으면', '2026-11-08', 'sheet'],
    ['오늘 닫았으면', '2026-11-09', 'toast'],
  ] as const)('%s %s로 알린다', (_case, dismissedOn, surface) => {
    // Given
    const todayKey = '2026-11-09';

    // When
    const result = getUpsellPresentation(dismissedOn, todayKey, {
      hasAlternativeAction: false,
    });

    // Then
    expect(result).toBe(surface);
  });

  it('대안 동작이 있으면 오늘 닫았어도 시트로 알린다', () => {
    // Given
    const todayKey = '2026-11-09';

    // When
    const result = getUpsellPresentation(todayKey, todayKey, {
      hasAlternativeAction: true,
    });

    // Then
    expect(result).toBe('sheet');
  });
});
