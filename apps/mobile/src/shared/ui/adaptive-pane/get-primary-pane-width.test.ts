import { getPrimaryPaneWidth } from './get-primary-pane-width';

describe('getPrimaryPaneWidth', () => {
  it('접힘선이 없으면 size class별 목록 폭을 쓴다', () => {
    // Given
    const foldFrame = undefined;

    // When
    const medium = getPrimaryPaneWidth({ windowSizeClass: 'medium', foldFrame });
    const expanded = getPrimaryPaneWidth({ windowSizeClass: 'expanded', foldFrame });

    // Then
    expect(medium).toBe(320);
    expect(expanded).toBe(400);
  });

  it('반쯤 접어 세로 접힘선이 있으면 목록을 접힘선 앞면 폭에 맞춘다', () => {
    // Given
    const foldFrame = { x: 412, y: 0, width: 20, height: 700 };

    // When
    const width = getPrimaryPaneWidth({ windowSizeClass: 'expanded', foldFrame });

    // Then
    expect(width).toBe(412);
  });
});
