import { getSafeAreaPadding } from './get-safe-area-padding';

/** 펼친 iPhone Duo 상세 칸: 오른쪽 레일과 홈 인디케이터 */
const DUO_DETAIL_PANE_INSETS = { top: 0, right: 84, bottom: 34, left: 0 };

describe('getSafeAreaPadding', () => {
  it('고른 가장자리에만 inset을 준다', () => {
    // Given
    const edges = ['left', 'right', 'bottom'] as const;

    // When
    const padding = getSafeAreaPadding(DUO_DETAIL_PANE_INSETS, edges);

    // Then
    expect(padding).toEqual({ paddingTop: 0, paddingRight: 84, paddingBottom: 34, paddingLeft: 0 });
  });

  it('고르지 않은 가장자리는 inset이 있어도 비우지 않는다', () => {
    // Given
    const insets = { top: 62, right: 0, bottom: 83, left: 0 };

    // When
    const padding = getSafeAreaPadding(insets, ['left', 'right']);

    // Then
    expect(padding).toEqual({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 });
  });
});
