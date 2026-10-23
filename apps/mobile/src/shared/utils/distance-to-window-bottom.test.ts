import { getDistanceToWindowBottom } from './distance-to-window-bottom';

describe('getDistanceToWindowBottom', () => {
  it('뷰가 창 아래까지 닿으면 0이다', () => {
    expect(getDistanceToWindowBottom(800, { top: 100, height: 700 })).toBe(0);
  });

  it('하단 탭 바가 뷰 아래에 있으면 그 높이를 돌려준다', () => {
    expect(getDistanceToWindowBottom(800, { top: 100, height: 620 })).toBe(80);
  });

  it('뷰가 창 밖으로 넘치면 음수 대신 0이다', () => {
    expect(getDistanceToWindowBottom(800, { top: 100, height: 740 })).toBe(0);
  });
});
