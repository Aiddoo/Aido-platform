import { getChipRevealScrollX } from './get-chip-reveal-scroll-x';

// 접은 Duo의 카테고리 색 줄: 보이는 폭 382(시트 466 - 레일 84), 앞뒤 여백 20, 색 칸 32 + 간격 10
const ROW_WIDTH = 382;
const CHIP_WIDTH = 32;

function getChip(index: number) {
  return { x: index * (CHIP_WIDTH + 10), width: CHIP_WIDTH };
}

describe('getChipRevealScrollX', () => {
  it('다 보이는 색을 누르면 줄을 밀지 않아 앞쪽 색이 잘리지 않는다', () => {
    // Given
    const chip = getChip(1);

    // When
    const scrollX = getChipRevealScrollX({ chip, scrollX: 0, rowWidth: ROW_WIDTH });

    // Then
    expect(scrollX).toBeNull();
  });

  it('뒤 여백까지 딱 들어가는 색은 밀지 않는다', () => {
    // Given
    // 310 + 32 + 여백 20 × 2 = 382
    const chip = { x: 310, width: CHIP_WIDTH };

    // When
    const scrollX = getChipRevealScrollX({ chip, scrollX: 0, rowWidth: ROW_WIDTH });

    // Then
    expect(scrollX).toBeNull();
  });

  it('줄 끝에 걸친 색은 뒤 여백까지 보일 만큼만 민다', () => {
    // Given
    // 9번째 색 336~368 + 여백 40 = 408 → 26 넘친다
    const chip = getChip(8);

    // When
    const scrollX = getChipRevealScrollX({ chip, scrollX: 0, rowWidth: ROW_WIDTH });

    // Then
    expect(scrollX).toBe(26);
  });

  it('고친 카테고리의 마지막 색은 처음부터 줄 끝에 보이게 민다', () => {
    // Given
    // 16번째 색 630~662 + 여백 40 - 382
    const chip = getChip(15);

    // When
    const scrollX = getChipRevealScrollX({ chip, scrollX: 0, rowWidth: ROW_WIDTH });

    // Then
    expect(scrollX).toBe(320);
  });

  it('앞으로 밀려 잘린 색은 앞 여백 자리까지만 되돌린다', () => {
    // Given
    const chip = getChip(1);

    // When
    const scrollX = getChipRevealScrollX({ chip, scrollX: 100, rowWidth: ROW_WIDTH });

    // Then
    expect(scrollX).toBe(42);
  });
});
