import { getSheetHorizontalMargin } from './get-sheet-horizontal-margin';

describe('getSheetHorizontalMargin', () => {
  it('최대 폭보다 좁은 창에서는 최소 여백만 둔다', () => {
    expect(getSheetHorizontalMargin(390, 16)).toBe(16);
  });

  it('넓은 창에서는 최대 폭 560을 가운데 정렬하는 여백을 둔다', () => {
    expect(getSheetHorizontalMargin(900, 16)).toBe(170);
  });
});
