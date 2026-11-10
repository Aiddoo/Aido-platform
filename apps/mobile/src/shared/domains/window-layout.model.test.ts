import { createAppWindow, DEVICE_WINDOW } from '@src/shared/__tests__/window-layout.fixtures';

import { WindowLayoutPolicy } from './window-layout.model';

describe('WindowLayoutPolicy.getSizeClass', () => {
  it.each([
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
  ] as const)('창 폭 %d이면 %s다', (width, expected) => {
    // Given
    const window = createAppWindow({ width });

    // When
    const sizeClass = WindowLayoutPolicy.getSizeClass(window);

    // Then
    expect(sizeClass).toBe(expected);
  });

  it('Mac 창은 넓어도 compact다', () => {
    // Given
    const window = createAppWindow({ os: 'ios', isDesktop: true, width: 1366, height: 1024 });

    // When
    const sizeClass = WindowLayoutPolicy.getSizeClass(window);

    // Then
    expect(sizeClass).toBe('compact');
  });
});

describe('WindowLayoutPolicy.getOrientationLock', () => {
  it.each([
    ['휴대폰 세로', DEVICE_WINDOW.phone, 'portrait'],
    ['접은 바깥 화면', DEVICE_WINDOW.foldedOuter, 'portrait'],
    ['좁은 바깥 화면', DEVICE_WINDOW.narrowFoldedOuter, 'portrait'],
    ['펼친 안쪽 화면', DEVICE_WINDOW.unfoldedInner, 'unlocked'],
    ['태블릿', DEVICE_WINDOW.tablet, 'unlocked'],
  ] as const)('Android %s는 %s다', (_device, size, expected) => {
    // Given
    const window = createAppWindow(size);

    // When
    const lock = WindowLayoutPolicy.getOrientationLock(window);

    // Then
    expect(lock).toBe(expected);
  });

  it('가로로 든 휴대폰도 짧은 변으로 재 세로로 묶는다', () => {
    // Given
    const window = createAppWindow({ width: 915, height: 412 });

    // When
    const lock = WindowLayoutPolicy.getOrientationLock(window);

    // Then
    expect(lock).toBe('portrait');
  });

  it('펼친 화면을 세로로 돌려도 풀린 채다', () => {
    // Given
    const window = createAppWindow({ width: 701, height: 841 });

    // When
    const lock = WindowLayoutPolicy.getOrientationLock(window);

    // Then
    expect(lock).toBe('unlocked');
  });

  it.each([
    [599, 'portrait'],
    [600, 'unlocked'],
  ] as const)('짧은 변이 %ddp이면 %s다(Android sw600dp 경계)', (smallestWidth, expected) => {
    // Given
    const window = createAppWindow({ width: 960, height: smallestWidth });

    // When
    const lock = WindowLayoutPolicy.getOrientationLock(window);

    // Then
    expect(lock).toBe(expected);
  });

  it.each([
    ['iPhone', { width: 402, height: 874 }],
    ['iPad', { width: 1180, height: 820 }],
  ] as const)('iOS %s는 Info.plist가 정해 앱이 방향을 바꾸지 않는다', (_device, size) => {
    // Given
    const window = createAppWindow({ os: 'ios', ...size });

    // When
    const lock = WindowLayoutPolicy.getOrientationLock(window);

    // Then
    expect(lock).toBeNull();
  });
});
