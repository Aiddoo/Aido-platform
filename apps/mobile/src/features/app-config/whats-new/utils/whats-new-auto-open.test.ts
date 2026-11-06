import { claimAndOpenWhatsNew } from './whats-new-auto-open';

describe('claimAndOpenWhatsNew', () => {
  it('안정된 자격 사용자는 본 상태를 먼저 claim한 뒤 허브를 연다', () => {
    // Given
    const order: string[] = [];

    // When
    const result = claimAndOpenWhatsNew({
      canAutoOpen: true,
      isStable: true,
      claim: () => {
        order.push('claim');
        return true;
      },
      open: () => order.push('open'),
    });

    // Then
    expect(result).toBe(true);
    expect(order).toEqual(['claim', 'open']);
  });

  it('claim 경쟁에서 지면 허브를 열지 않는다', () => {
    // Given
    const open = jest.fn();

    // When
    const result = claimAndOpenWhatsNew({
      canAutoOpen: true,
      isStable: true,
      claim: () => false,
      open,
    });

    // Then
    expect(result).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    [{ canAutoOpen: false, isStable: true }, '자격 없음'],
    [{ canAutoOpen: true, isStable: false }, '피드 불안정'],
  ])('%s이면 claim도 시도하지 않는다', (conditions, _label) => {
    // Given
    const claim = jest.fn(() => true);
    const open = jest.fn();

    // When
    const result = claimAndOpenWhatsNew({
      ...conditions,
      claim,
      open,
    });

    // Then
    expect(result).toBe(false);
    expect(claim).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
