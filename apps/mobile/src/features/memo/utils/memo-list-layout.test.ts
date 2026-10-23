import { distributeMemosIntoColumns, getMemoColumnCount } from './memo-list-layout';

describe('getMemoColumnCount', () => {
  it('compact는 두 열, 펼친 화면의 좁은 목록 pane은 한 열이다', () => {
    expect(getMemoColumnCount('compact')).toBe(2);
    expect(getMemoColumnCount('medium')).toBe(1);
    expect(getMemoColumnCount('expanded')).toBe(1);
  });
});

describe('distributeMemosIntoColumns', () => {
  it('왼쪽 열부터 번갈아 배치한다', () => {
    expect(distributeMemosIntoColumns([1, 2, 3, 4, 5], 2)).toEqual([
      { key: 'column-0', items: [1, 3, 5] },
      { key: 'column-1', items: [2, 4] },
    ]);
  });

  it('한 열이면 순서를 그대로 유지한다', () => {
    expect(distributeMemosIntoColumns([1, 2, 3], 1)).toEqual([
      { key: 'column-0', items: [1, 2, 3] },
    ]);
  });
});
