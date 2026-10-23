import { getWindowSizeClass } from './window-size-class';

describe('getWindowSizeClass', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
    [1200, 'expanded'],
  ])('창 폭 %ddp는 %s로 분류한다', (windowWidth, expected) => {
    expect(getWindowSizeClass(windowWidth)).toBe(expected);
  });
});
