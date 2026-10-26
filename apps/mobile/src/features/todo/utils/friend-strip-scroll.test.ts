import { getFriendStripRevealOffset } from './friend-strip-scroll';

const VIEWPORT = { scrollOffset: 200, viewportWidth: 300, edgePeek: 28 };

describe('getFriendStripRevealOffset', () => {
  it('선택한 친구가 가장자리 여유까지 다 보이면 움직이지 않는다', () => {
    // Given: 보이는 영역 200~500에서 여유(28)를 뺀 228~472 안의 항목
    const input = { ...VIEWPORT, itemStart: 300, itemWidth: 56 };

    // When
    const offset = getFriendStripRevealOffset(input);

    // Then
    expect(offset).toBeNull();
  });

  it('왼쪽으로 잘린 친구는 왼쪽에 여유를 남기고 보인다', () => {
    const offset = getFriendStripRevealOffset({ ...VIEWPORT, itemStart: 180, itemWidth: 56 });

    expect(offset).toBe(152);
  });

  it('오른쪽으로 잘린 친구는 오른쪽에 여유를 남기고 보인다', () => {
    const offset = getFriendStripRevealOffset({ ...VIEWPORT, itemStart: 430, itemWidth: 56 });

    expect(offset).toBe(214);
  });

  it('아직 화면 밖 멀리 있는 친구(딥링크로 고른 친구)도 오른쪽 가장자리까지 옮긴다', () => {
    const offset = getFriendStripRevealOffset({ ...VIEWPORT, itemStart: 3200, itemWidth: 56 });

    expect(offset).toBe(2984);
  });

  it('맨 앞 친구는 콘텐츠 시작보다 앞으로 넘기지 않는다', () => {
    const offset = getFriendStripRevealOffset({ ...VIEWPORT, itemStart: 8, itemWidth: 56 });

    expect(offset).toBe(0);
  });

  it('이미 맨 앞이면 움직이지 않는다', () => {
    const offset = getFriendStripRevealOffset({
      ...VIEWPORT,
      scrollOffset: 0,
      itemStart: 8,
      itemWidth: 56,
    });

    expect(offset).toBeNull();
  });
});
