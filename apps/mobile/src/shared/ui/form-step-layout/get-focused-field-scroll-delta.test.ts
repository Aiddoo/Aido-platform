import { getCaretScrollDelta, getFocusedFieldScrollDelta } from './get-focused-field-scroll-delta';

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
    expect(getCaretScrollDelta(VISIBLE, { top: 395, bottom: 415 })).toBe(15);
  });

  it('보이는 커서는 그대로 둔다', () => {
    expect(getCaretScrollDelta(VISIBLE, { top: 200, bottom: 220 })).toBe(0);
  });

  it('보이는 곳 위로 지나간 커서 줄은 되돌린다', () => {
    expect(getCaretScrollDelta(VISIBLE, { top: 80, bottom: 100 })).toBe(-20);
  });
});
