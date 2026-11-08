import {
  getBodyHeightAboveKeyboard,
  getKeyboardHiddenHeight,
  getKeyboardSheetMaxHeight,
} from './keyboard-bottom-sheet.geometry';

// 창 높이 800, 위쪽 한계 50 → 시트 최대 높이 800 - 50 - 위 여백 24 - 손잡이 24 = 702
const WINDOW_HEIGHT = 800;
const TOP_INSET = 50;
const MAX_SHEET_HEIGHT = 702;

describe('getKeyboardSheetMaxHeight', () => {
  it('위쪽 한계에서 위 여백과 손잡이를 뺀다', () => {
    // Given
    const windowHeight = WINDOW_HEIGHT;

    // When
    const maxHeight = getKeyboardSheetMaxHeight(windowHeight, TOP_INSET);

    // Then
    expect(maxHeight).toBe(MAX_SHEET_HEIGHT);
  });

  it('창이 낮아도 최소 내용 높이(280)에서 손잡이만 뺀 만큼은 남긴다', () => {
    // Given
    const windowHeight = 300;

    // When
    const maxHeight = getKeyboardSheetMaxHeight(windowHeight, TOP_INSET);

    // Then
    expect(maxHeight).toBe(256);
  });
});

describe('getKeyboardHiddenHeight', () => {
  function getHiddenHeight(contentHeight: number, keyboardHeight: number) {
    return getKeyboardHiddenHeight({
      contentHeight,
      keyboardHeight,
      maxSheetHeight: MAX_SHEET_HEIGHT,
      windowHeight: WINDOW_HEIGHT,
      topInset: TOP_INSET,
    });
  }

  it('키보드가 없으면 가린 곳이 없다', () => {
    // Given
    const keyboardHeight = 0;

    // When
    const hiddenHeight = getHiddenHeight(1000, keyboardHeight);

    // Then
    expect(hiddenHeight).toBeNull();
  });

  it('시트가 키보드 위에 다 들어가면 가린 곳이 없다', () => {
    // Given
    // 시트 200 + 손잡이 24 + 키보드 300 = 524 < 위쪽 한계 아래 750
    const contentHeight = 200;

    // When
    const hiddenHeight = getHiddenHeight(contentHeight, 300);

    // Then
    expect(hiddenHeight).toBeNull();
  });

  it('시트가 위쪽 한계에 딱 닿으면 가린 높이는 0이다', () => {
    // Given
    // 내용 426 + 손잡이 24 + 키보드 300 = 750
    const contentHeight = 426;

    // When
    const hiddenHeight = getHiddenHeight(contentHeight, 300);

    // Then
    expect(hiddenHeight).toBe(0);
  });

  it('긴 내용은 최대 높이로 줄인 시트가 키보드에 가린 만큼이다', () => {
    // Given
    // 시트 702 + 키보드 300 - 750 = 252
    const contentHeight = 1000;

    // When
    const hiddenHeight = getHiddenHeight(contentHeight, 300);

    // Then
    expect(hiddenHeight).toBe(252);
  });
});

describe('getBodyHeightAboveKeyboard', () => {
  it('키보드가 높으면 키보드 위 공간에서 손잡이와 고정 높이를 뺀다', () => {
    // Given
    // 키보드 위 500 - 위쪽 한계 50 = 450 < 최대 높이 702
    const keyboardTop = 500;

    // When
    const bodyHeight = getBodyHeightAboveKeyboard({
      keyboardTop,
      topInset: TOP_INSET,
      maxSheetHeight: MAX_SHEET_HEIGHT,
      reservedHeight: 100,
    });

    // Then
    expect(bodyHeight).toBe(326);
  });

  it('키보드 위 공간이 최대 높이보다 넓으면 최대 높이까지만 쓴다', () => {
    // Given
    const keyboardTop = 900;

    // When
    const bodyHeight = getBodyHeightAboveKeyboard({
      keyboardTop,
      topInset: TOP_INSET,
      maxSheetHeight: MAX_SHEET_HEIGHT,
      reservedHeight: 100,
    });

    // Then
    expect(bodyHeight).toBe(578);
  });
});
