import { getSheetHorizontalMargins } from './get-sheet-horizontal-margins';

const NO_INSETS = { left: 0, right: 0 };

describe('getSheetHorizontalMargins', () => {
  it('최대 폭보다 좁은 창에서는 최소 여백만 둔다', () => {
    expect(getSheetHorizontalMargins(390, NO_INSETS, 16)).toEqual({ left: 16, right: 16 });
  });

  it('넓은 창에서는 최대 폭 560을 가운데 정렬하는 여백을 둔다', () => {
    expect(getSheetHorizontalMargins(900, NO_INSETS, 16)).toEqual({ left: 170, right: 170 });
  });

  it('접은 iPhone Duo처럼 오른쪽 레일이 있으면 레일 바깥에 최소 여백을 둔다', () => {
    expect(getSheetHorizontalMargins(466, { left: 0, right: 84 }, 16)).toEqual({
      left: 16,
      right: 100,
    });
  });

  it('넓은 창에 레일이 있으면 레일을 뺀 콘텐츠 영역 기준으로 가운데 정렬한다', () => {
    expect(getSheetHorizontalMargins(984, { left: 0, right: 84 }, 16)).toEqual({
      left: 170,
      right: 254,
    });
  });

  it('최소 여백이 0이면 safe area만큼만 비운다', () => {
    expect(getSheetHorizontalMargins(466, { left: 0, right: 84 }, 0)).toEqual({
      left: 0,
      right: 84,
    });
  });
});
