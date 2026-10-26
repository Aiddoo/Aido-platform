import {
  getFocusedInputScrollOffset,
  getLayoutAboveKeyboard,
} from './get-focused-input-scroll-offset';

// 키보드가 올라와 줄어든 시트 스크롤 영역: 창 y 100~400, 아래 80은 고정 footer라 실제로 보이는 곳은 100~320
const VIEWPORT = { top: 100, height: 300 };
const FOOTER_HEIGHT = 80;
const MARGINS = { marginAbove: 40, marginBelow: 20 };

describe('getFocusedInputScrollOffset', () => {
  it('footer에 가린 입력은 아래 여백까지 footer 위로 올라오게 스크롤한다', () => {
    // Given: 스크롤 0, 입력 창 y 360~420
    const input = {
      viewport: VIEWPORT,
      content: { top: 100, height: 700 },
      input: { top: 360, height: 60 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then: 입력 아래 + 여백(440)이 footer 위(320)에 닿도록 120만큼
    expect(offset).toBe(120);
  });

  it('이미 라벨까지 보이는 입력이면 스크롤하지 않는다', () => {
    // Given
    const input = {
      viewport: VIEWPORT,
      content: { top: 100, height: 700 },
      input: { top: 150, height: 60 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then
    expect(offset).toBeNull();
  });

  it('위로 지나간 입력은 라벨이 보이게 되돌린다', () => {
    // Given: 200만큼 스크롤했고 입력이 창 y 110에 있다
    const input = {
      viewport: VIEWPORT,
      content: { top: -100, height: 700 },
      input: { top: 110, height: 60 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then: 입력 위(110)가 140에 오도록 30만큼 되돌린다
    expect(offset).toBe(170);
  });

  it('보이는 높이가 라벨까지 담기엔 좁으면 입력 칸 전체가 footer 위에 오는 쪽을 우선한다', () => {
    // Given: 보이는 높이 80(100~180)에 입력 60 + 여백 60은 들어가지 않는다
    const input = {
      viewport: { top: 100, height: 160 },
      content: { top: 100, height: 700 },
      input: { top: 300, height: 60 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then: 입력 아래 + 여백(380)이 180에 오도록 200만큼
    expect(offset).toBe(200);
  });

  it('입력 자체가 보이는 높이보다 크면 커서가 있는 위쪽을 맞춘다', () => {
    // Given: 보이는 높이 220보다 큰 260 입력
    const input = {
      viewport: VIEWPORT,
      content: { top: 100, height: 900 },
      input: { top: 300, height: 260 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then
    expect(offset).toBe(200);
  });

  it('내용 끝을 넘어 스크롤하지 않는다', () => {
    // Given: 최대 스크롤 위치 = 500 - 300 = 200
    const input = {
      viewport: VIEWPORT,
      content: { top: 100, height: 500 },
      input: { top: 560, height: 30 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then
    expect(offset).toBe(200);
  });

  it('이 스크롤 내용 밖에 있는 입력(시트 뒤 화면)은 건드리지 않는다', () => {
    // Given
    const input = {
      viewport: VIEWPORT,
      content: { top: 100, height: 500 },
      input: { top: 700, height: 40 },
      bottomInset: FOOTER_HEIGHT,
      ...MARGINS,
    };

    // When
    const offset = getFocusedInputScrollOffset(input);

    // Then
    expect(offset).toBeNull();
  });
});

describe('getLayoutAboveKeyboard', () => {
  // iPhone 17 Pro 신고 시트: 키보드 없이 창 y 182~874, 키보드 위 끝 546, 위쪽 한계 86(topInset 62 + 손잡이 24)
  const AT_REST = {
    viewport: { top: 182, height: 692 },
    content: { top: 182, height: 692 },
    input: { top: 603, height: 62 },
  };

  it('위쪽 한계에 닿는 시트는 영역 높이가 줄고, 내용은 영역과 함께 올라간다', () => {
    // When
    const layout = getLayoutAboveKeyboard(AT_REST, 546, 86);

    // Then: 실제로 다 올라온 뒤 잰 값(창 y 86, 높이 460)과 같다
    expect(layout).toEqual({
      viewport: { top: 86, height: 460 },
      content: { top: 86, height: 692 },
      input: { top: 507, height: 62 },
    });
  });

  it('키보드 위에 다 들어가는 시트는 높이를 그대로 두고 키보드만큼 올린다', () => {
    // Given
    const short = {
      viewport: { top: 600, height: 274 },
      content: { top: 600, height: 274 },
      input: { top: 650, height: 40 },
    };

    // When
    const layout = getLayoutAboveKeyboard(short, 546, 86);

    // Then
    expect(layout).toEqual({
      viewport: { top: 272, height: 274 },
      content: { top: 272, height: 274 },
      input: { top: 322, height: 40 },
    });
  });
});
