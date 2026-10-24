import { getPrimaryPaneWidth } from './get-primary-pane-width';

describe('getPrimaryPaneWidth', () => {
  it('완전히 펼친 자세는 size class별 목록 폭을 쓴다', () => {
    // Given
    const windowWidth = 900;

    // When
    const medium = getPrimaryPaneWidth({
      windowSizeClass: 'medium',
      isBookPosture: false,
      windowWidth,
    });
    const expanded = getPrimaryPaneWidth({
      windowSizeClass: 'expanded',
      isBookPosture: false,
      windowWidth,
    });

    // Then
    expect(medium).toBe(320);
    expect(expanded).toBe(400);
  });

  it('반쯤 펼친 책 자세는 구분선을 창 가운데 접힘선에 둔다', () => {
    // Given
    const windowWidth = 845;

    // When
    const width = getPrimaryPaneWidth({
      windowSizeClass: 'expanded',
      isBookPosture: true,
      windowWidth,
    });

    // Then
    expect(width).toBe(423);
  });
});
