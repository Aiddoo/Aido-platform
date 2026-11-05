import { getHintPlacement } from './hint-popover';

const SCREEN = { windowHeight: 800, topInset: 48, bottomInset: 34, offset: 9 };

describe('getHintPlacement', () => {
  test.each([
    {
      name: '위에 자리가 있으면 위',
      placement: 'top',
      triggerY: 400,
      triggerHeight: 40,
      contentHeight: 100,
      expected: 'top',
    },
    {
      name: '상태바와 겹치면 아래로 뒤집는다',
      placement: 'top',
      triggerY: 60,
      triggerHeight: 40,
      contentHeight: 100,
      expected: 'bottom',
    },
    {
      name: '아래에 자리가 있으면 아래',
      placement: 'bottom',
      triggerY: 200,
      triggerHeight: 40,
      contentHeight: 100,
      expected: 'bottom',
    },
    {
      name: '홈 표시줄과 겹치면 위로 뒤집는다',
      placement: 'bottom',
      triggerY: 700,
      triggerHeight: 40,
      contentHeight: 100,
      expected: 'top',
    },
    {
      name: '양쪽 다 모자라면 자리가 더 많은 아래',
      placement: 'top',
      triggerY: 100,
      triggerHeight: 40,
      contentHeight: 700,
      expected: 'bottom',
    },
    {
      name: '양쪽 다 모자라면 자리가 더 많은 위',
      placement: 'bottom',
      triggerY: 600,
      triggerHeight: 40,
      contentHeight: 700,
      expected: 'top',
    },
    {
      name: '옆으로 뜨면 그대로',
      placement: 'left',
      triggerY: 10,
      triggerHeight: 40,
      contentHeight: 700,
      expected: 'left',
    },
  ] as const)('$name', ({ placement, triggerY, triggerHeight, contentHeight, expected }) => {
    // When
    const result = getHintPlacement({
      ...SCREEN,
      placement,
      trigger: { pageY: triggerY, height: triggerHeight },
      contentHeight,
    });

    // Then
    expect(result).toBe(expected);
  });

  test('아직 재지 못했으면 요청한 방향이다', () => {
    // When
    const result = getHintPlacement({
      ...SCREEN,
      placement: 'top',
      trigger: null,
      contentHeight: null,
    });

    // Then
    expect(result).toBe('top');
  });
});
