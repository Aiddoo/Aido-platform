import {
  type FocusedFieldScrollInput,
  getCaretScrollDelta,
  getCaretTargetScroll,
  getFocusedFieldScrollDelta,
  getFocusedFieldTargetScroll,
  getKeyboardTransitionScroll,
  toFocusedInputField,
} from './focused-field-scroll.geometry';

// 키보드와 버튼을 뺀 보이는 곳: 창 y 100~400
const VISIBLE = { top: 100, bottom: 400 };

describe('getFocusedFieldScrollDelta', () => {
  it('버튼에 가린 칸은 오류 문구·글자 수까지 버튼 위로 올라오게 스크롤한다', () => {
    // Given
    // 칸 360~460(아래 40은 오류 문구·글자 수), 커서는 첫 줄
    const layout = {
      visible: VISIBLE,
      field: { top: 360, bottom: 460 },
      caret: { top: 380, bottom: 400 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(60);
  });

  it('이미 보이는 칸은 스크롤하지 않는다', () => {
    // Given
    const layout = {
      visible: VISIBLE,
      field: { top: 150, bottom: 300 },
      caret: { top: 170, bottom: 190 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(0);
  });

  it('보이는 곳보다 큰 칸에서 커서가 위에 있으면 칸 위를 보이는 곳 위에 맞춘다', () => {
    // Given
    // 칸 높이 400 > 보이는 높이 300, 커서는 첫 줄
    const layout = {
      visible: VISIBLE,
      field: { top: 250, bottom: 650 },
      caret: { top: 270, bottom: 290 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(150);
  });

  it('보이는 곳보다 큰 칸에서 커서가 아래에 있으면 칸 아래를 버튼 위에 맞춘다', () => {
    // Given
    // 커서가 칸 끝 줄(590~610)이라 아래를 맞춰도 커서 위(340)가 보인다
    const layout = {
      visible: VISIBLE,
      field: { top: 250, bottom: 650 },
      caret: { top: 590, bottom: 610 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(250);
  });

  it('칸 위를 맞춰도 커서가 가리면 커서 줄을 버튼 위에 맞춘다', () => {
    // Given
    // 칸 250~900, 커서 560~580: 칸 아래를 맞추면(500) 커서가 위로 지나가고, 칸 위를 맞추면(150) 커서 아래가 430으로 가린다
    const layout = {
      visible: VISIBLE,
      field: { top: 250, bottom: 900 },
      caret: { top: 560, bottom: 580 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(180);
  });

  it('키보드가 낮아져 보이는 곳이 넓어지면 큰 칸은 아래를 버튼 위에 둔 채 되돌린다', () => {
    // Given
    // 칸 -300~350(위는 지나감), 아래는 버튼 위(400)보다 50 위, 커서는 가운데
    const layout = {
      visible: VISIBLE,
      field: { top: -300, bottom: 350 },
      caret: { top: 200, bottom: 220 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(-50);
  });

  it('보이는 곳 위로 지나간 칸은 칸 위가 보이게 되돌린다', () => {
    // Given
    const layout = {
      visible: VISIBLE,
      field: { top: 40, bottom: 140 },
      caret: { top: 60, bottom: 80 },
    };

    // When
    const delta = getFocusedFieldScrollDelta(layout);

    // Then
    expect(delta).toBe(-60);
  });
});

describe('getCaretScrollDelta', () => {
  it('버튼에 가린 커서 줄만큼만 스크롤한다', () => {
    // Given
    const caret = { top: 395, bottom: 415 };

    // When
    const delta = getCaretScrollDelta(VISIBLE, caret);

    // Then
    expect(delta).toBe(15);
  });

  it('보이는 커서는 그대로 둔다', () => {
    // Given
    const caret = { top: 200, bottom: 220 };

    // When
    const delta = getCaretScrollDelta(VISIBLE, caret);

    // Then
    expect(delta).toBe(0);
  });

  it('보이는 곳 위로 지나간 커서 줄은 되돌린다', () => {
    // Given
    const caret = { top: 80, bottom: 100 };

    // When
    const delta = getCaretScrollDelta(VISIBLE, caret);

    // Then
    expect(delta).toBe(-20);
  });

  it('보이는 곳 아래 끝에 딱 닿은 커서 줄은 그대로 둔다', () => {
    // Given
    const caret = { top: 380, bottom: 400 };

    // When
    const delta = getCaretScrollDelta(VISIBLE, caret);

    // Then
    expect(delta).toBe(0);
  });
});

// 창 높이 800, 스크롤 영역 창 y 100~700, 키보드 300 + 버튼 56 → 보이는 곳 100~436(버튼 위 8 비움)
function createScrollInput(
  overrides: Partial<FocusedFieldScrollInput> = {},
): FocusedFieldScrollInput {
  return {
    fromScroll: 0,
    viewport: { top: 100, height: 600 },
    windowHeight: 800,
    keyboardHeight: 300,
    footerHeight: 56,
    field: { top: 300, bottom: 400, inputTop: 320, inputHeight: 60 },
    caret: null,
    ...overrides,
  };
}

describe('getFocusedFieldTargetScroll', () => {
  it('키보드가 없으면 스크롤하지 않는다', () => {
    // Given
    const input = createScrollInput({ fromScroll: 40, keyboardHeight: 0 });

    // When
    const target = getFocusedFieldTargetScroll(input);

    // Then
    expect(target).toBe(40);
  });

  it('키보드와 버튼에 가린 칸 아래를 버튼 위 여백까지 올린다', () => {
    // Given
    // 칸 창 y 400~500, 보이는 곳 아래 436
    const input = createScrollInput();

    // When
    const target = getFocusedFieldTargetScroll(input);

    // Then
    expect(target).toBe(64);
  });

  it('스크롤한 만큼 칸의 창 좌표를 옮겨 잰다', () => {
    // Given
    // 이미 64 스크롤해 칸 아래가 보이는 곳 아래 끝에 있다
    const input = createScrollInput({ fromScroll: 64 });

    // When
    const target = getFocusedFieldTargetScroll(input);

    // Then
    expect(target).toBe(64);
  });

  it('위로 되돌릴 때 0보다 위로 가지 않는다', () => {
    // Given
    // 칸 위(창 y 70)가 보이는 곳 위(100)를 지나 되돌려야 하지만 스크롤은 10뿐이다
    const input = createScrollInput({
      fromScroll: 10,
      field: { top: -20, bottom: 40, inputTop: 0, inputHeight: 40 },
    });

    // When
    const target = getFocusedFieldTargetScroll(input);

    // Then
    expect(target).toBe(0);
  });

  it('입력 밖으로 알린 커서 줄은 입력 안으로 잘라 지킨다', () => {
    // Given
    // 커서를 입력 끝(창 y 400)으로 잘라 넘친 값(창 y 720)만큼 더 내리지 않고 칸 아래(700)를 보이는 곳 아래(436)에 맞춘다
    const input = createScrollInput({
      field: { top: 100, bottom: 600, inputTop: 120, inputHeight: 180 },
      caret: { top: 500, bottom: 520 },
    });

    // When
    const target = getFocusedFieldTargetScroll(input);

    // Then
    expect(target).toBe(264);
  });
});

describe('getCaretTargetScroll', () => {
  it('커서를 모르면 입력 칸 첫 줄을 보이게 한다', () => {
    // Given
    // 입력 위가 창 y 440이라 보이는 곳 아래(436)보다 4 아래다
    const input = createScrollInput({
      field: { top: 320, bottom: 420, inputTop: 340, inputHeight: 60 },
    });

    // When
    const target = getCaretTargetScroll(input);

    // Then
    expect(target).toBe(4);
  });

  it('보이는 커서 줄은 그대로 둔다', () => {
    // Given
    const input = createScrollInput({ fromScroll: 30, caret: { top: 0, bottom: 20 } });

    // When
    const target = getCaretTargetScroll(input);

    // Then
    expect(target).toBe(30);
  });
});

describe('getKeyboardTransitionScroll', () => {
  const transition = { fromHeight: 0, toHeight: 300, fromScroll: 100 };

  it('키보드가 움직인 비율만큼 목표 쪽으로 옮긴다', () => {
    // Given
    const keyboardHeight = 150;

    // When
    const scroll = getKeyboardTransitionScroll(transition, keyboardHeight, 300);

    // Then
    expect(scroll).toBe(200);
  });

  it('키보드가 범위를 넘어 보고돼도 시작과 목표 사이에 둔다', () => {
    // Given
    const overshoot = 360;
    const undershoot = -20;

    // When
    const afterEnd = getKeyboardTransitionScroll(transition, overshoot, 300);
    const beforeStart = getKeyboardTransitionScroll(transition, undershoot, 300);

    // Then
    expect(afterEnd).toBe(300);
    expect(beforeStart).toBe(100);
  });

  it('키보드 높이가 그대로면 바로 목표로 간다', () => {
    // Given
    const unchanged = { fromHeight: 300, toHeight: 300, fromScroll: 100 };

    // When
    const scroll = getKeyboardTransitionScroll(unchanged, 300, 180);

    // Then
    expect(scroll).toBe(180);
  });
});

describe('toFocusedInputField', () => {
  it('포커스한 입력의 창 좌표를 그때 스크롤 기준 내용 좌표로 바꾼다', () => {
    // Given
    const input = { absoluteY: 350, height: 48 };

    // When
    const field = toFocusedInputField(input, 100, 40);

    // Then
    expect(field).toEqual({ top: 290, bottom: 338, inputTop: 290, inputHeight: 48 });
  });
});
