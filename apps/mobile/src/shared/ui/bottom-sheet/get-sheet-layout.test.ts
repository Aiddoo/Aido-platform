import type { ReservedRegion } from 'react-native-reserved-regions';

import { getSheetLayout } from './get-sheet-layout';

const FOLDED_DUO_INSETS = { top: 0, left: 0, right: 84 };
const STATUS_OCCLUSION: ReservedRegion = {
  kind: 'occlusion',
  frame: { x: 378, y: 20, width: 88, height: 137 },
};

describe('getSheetLayout', () => {
  it('화면 안 시트는 접은 iPhone Duo의 레일을 피한다', () => {
    // Given
    const input = {
      windowWidth: 466,
      safeAreaInsets: FOLDED_DUO_INSETS,
      minMargin: 16,
      isFullWindowHost: false,
      reservedRegions: [STATUS_OCCLUSION],
    };

    // When
    const layout = getSheetLayout(input);

    // Then
    expect(layout).toEqual({ margins: { left: 16, right: 100 }, topInset: 0 });
  });

  it('전체 창 호스트의 시트는 레일을 덮어 좌우 대칭으로 채우고 상태 표시 영역 아래에서 시작한다', () => {
    // Given
    const input = {
      windowWidth: 466,
      safeAreaInsets: FOLDED_DUO_INSETS,
      minMargin: 16,
      isFullWindowHost: true,
      reservedRegions: [STATUS_OCCLUSION],
    };

    // When
    const layout = getSheetLayout(input);

    // Then
    expect(layout).toEqual({ margins: { left: 16, right: 16 }, topInset: 157 });
  });

  it('반쯤 접힌 세로 접힘선이 있으면 더 넓은 면에만 시트를 둔다', () => {
    // Given
    const fold: ReservedRegion = {
      kind: 'division',
      frame: { x: 400, y: 0, width: 20, height: 700 },
      occludesContent: false,
    };
    const input = {
      windowWidth: 900,
      safeAreaInsets: { top: 24, left: 0, right: 0 },
      minMargin: 16,
      isFullWindowHost: true,
      reservedRegions: [fold],
    };

    // When
    const layout = getSheetLayout(input);

    // Then
    expect(layout).toEqual({ margins: { left: 436, right: 16 }, topInset: 24 });
  });

  it('시트와 가로로 겹치지 않는 occlusion은 위쪽 한계에 넣지 않는다', () => {
    // Given
    const input = {
      windowWidth: 1200,
      safeAreaInsets: { top: 24, left: 0, right: 0 },
      minMargin: 16,
      isFullWindowHost: true,
      reservedRegions: [{ ...STATUS_OCCLUSION, frame: { x: 1100, y: 20, width: 88, height: 137 } }],
    };

    // When
    const layout = getSheetLayout(input);

    // Then
    expect(layout).toEqual({ margins: { left: 320, right: 320 }, topInset: 24 });
  });
});
