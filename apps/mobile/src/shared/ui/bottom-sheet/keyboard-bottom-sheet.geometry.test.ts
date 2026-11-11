import {
  getBodyHeightAboveKeyboard,
  getKeyboardHiddenHeight,
  getKeyboardSheetContentPadding,
  getKeyboardSheetMaxHeight,
  getKeyboardSheetTopInset,
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

describe('getKeyboardSheetTopInset', () => {
  // 접은 Duo는 시뮬레이터에서 잰 값이다. 위쪽 safe area가 0이고 레일의 상태 표시 occlusion이 170까지 시트와 겹친다
  // 카테고리 시트 내용 = 위 여백 20 + 이름 칸·색 한 줄 163 + 아래 여백(safe area + 4) + footer 64
  const SHORT_WINDOWS = {
    iPhoneDuoFolded: { windowHeight: 678, safeAreaTop: 0, topInset: 170, contentHeight: 285 },
    iPhoneSe: { windowHeight: 667, safeAreaTop: 20, topInset: 20, contentHeight: 271 },
  } as const;

  it.each([
    ['iPhoneDuoFolded', 304],
    ['iPhoneDuoFolded', 336],
    ['iPhoneDuoFolded', 291],
    ['iPhoneSe', 336],
    ['iPhoneSe', 291],
  ] as const)(
    '%s에서 키보드 %d를 올려도 카테고리 시트의 이름 칸·색 줄·확인이 모두 키보드 위에 보인다',
    (device, keyboardHeight) => {
      // Given
      const { windowHeight, safeAreaTop, topInset, contentHeight } = SHORT_WINDOWS[device];

      // When
      const hiddenHeight = getKeyboardHiddenHeight({
        contentHeight,
        keyboardHeight,
        maxSheetHeight: getKeyboardSheetMaxHeight(windowHeight, topInset),
        windowHeight,
        topInset: getKeyboardSheetTopInset({ topInset, safeAreaTop }),
      });

      // Then
      expect(hiddenHeight).toBeNull();
    },
  );

  it('접은 Duo에서 긴 내용은 상태 표시 아래가 아니라 위쪽 safe area까지 올라가고 나머지만 키보드에 가린다', () => {
    // Given
    const { windowHeight, safeAreaTop, topInset } = SHORT_WINDOWS.iPhoneDuoFolded;

    // When
    const hiddenHeight = getKeyboardHiddenHeight({
      contentHeight: 1000,
      keyboardHeight: 336,
      maxSheetHeight: getKeyboardSheetMaxHeight(windowHeight, topInset),
      windowHeight,
      topInset: getKeyboardSheetTopInset({ topInset, safeAreaTop }),
    });

    // Then
    // 쉬는 최대 높이 460 + 키보드 336 - 창 678 = 118. 상태 표시 아래(170)에서 멈추면 288이 가렸다
    expect(hiddenHeight).toBe(118);
  });

  it('접은 Duo에서 키보드 위에 남는 내용 높이가 이름 칸·색 한 줄(163)보다 크다', () => {
    // Given
    const { windowHeight, safeAreaTop, topInset } = SHORT_WINDOWS.iPhoneDuoFolded;

    // When
    const bodyHeight = getBodyHeightAboveKeyboard({
      keyboardTop: windowHeight - 336,
      topInset: getKeyboardSheetTopInset({ topInset, safeAreaTop }),
      maxSheetHeight: getKeyboardSheetMaxHeight(windowHeight, topInset),
      reservedHeight: 20 + 64,
    });

    // Then
    // 키보드 위 342 - 손잡이 24 - 위 여백·footer 84 = 234. 상태 표시 아래(170)에서 멈추면 64였다
    expect(bodyHeight).toBe(234);
  });

  it('occlusion이 위쪽 safe area 안에 있는 창(일반 iPhone·iPad)은 쉬는 시트와 같은 한계라 지금과 같다', () => {
    // Given
    const layout = { topInset: 59, safeAreaTop: 59 };

    // When
    const keyboardTopInset = getKeyboardSheetTopInset(layout);

    // Then
    expect(keyboardTopInset).toBe(layout.topInset);
  });
});

describe('getKeyboardSheetContentPadding', () => {
  it.each([
    [
      '레일을 다 덮은 접은 Duo 시트는 오른쪽에 레일 84만큼 더 들인다',
      { left: 0, right: 0 },
      { left: 0, right: 84 },
      { left: 20, right: 104 },
    ],
    [
      '가로 safe area가 없는 일반 iPhone은 지금처럼 20이다',
      { left: 0, right: 0 },
      { left: 0, right: 0 },
      { left: 20, right: 20 },
    ],
    [
      '레일과 일부만 겹친 가운데 시트는 겹친 만큼만 더 들인다',
      { left: 70, right: 70 },
      { left: 0, right: 84 },
      { left: 20, right: 34 },
    ],
  ] as const)('%s', (_case, margins, safeAreaInsets, expected) => {
    // Given
    const layout = { margins, safeAreaInsets };

    // When
    const padding = getKeyboardSheetContentPadding(layout);

    // Then
    expect(padding).toEqual(expected);
  });
});
