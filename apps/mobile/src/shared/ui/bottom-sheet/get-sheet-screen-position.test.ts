import { getSheetScreenPosition } from './get-sheet-screen-position';

describe('getSheetScreenPosition', () => {
  it('창 폭 시트 안에서 잰 자리에 시트가 뜬 높이를 더한다', () => {
    // Given
    const position = { pageX: 300, pageY: 180, width: 40, height: 24 };
    const sheetOrigin = { pageX: 0, pageY: 0, width: 390, height: 320 };

    // When
    const screenPosition = getSheetScreenPosition({
      position,
      sheetOrigin,
      sheetTop: 500,
      windowWidth: 390,
    });

    // Then
    expect(screenPosition).toEqual({ pageX: 300, pageY: 680, width: 40, height: 24 });
  });

  it('창보다 좁은 시트는 가운데에 뜬 만큼 옆으로 옮기고 React 트리 속 시트 자리는 뺀다', () => {
    // Given
    const position = { pageX: 120, pageY: 260, width: 40, height: 24 };
    const sheetOrigin = { pageX: 20, pageY: 60, width: 700, height: 400 };

    // When
    const screenPosition = getSheetScreenPosition({
      position,
      sheetOrigin,
      sheetTop: 600,
      windowWidth: 1024,
    });

    // Then
    expect(screenPosition).toEqual({ pageX: 262, pageY: 800, width: 40, height: 24 });
  });
});
