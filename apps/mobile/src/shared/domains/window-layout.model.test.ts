import {
  createAppWindow,
  DEVICE_WINDOW,
  IPAD_SIDEBAR_WIDTH,
} from '@src/testing/window-layout.fixtures';

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

describe('WindowLayoutPolicy.getPaneSizeClass', () => {
  it.each([
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
  ] as const)('창이 넓어도 잰 영역 폭 %d으로 %s다', (areaWidth, expected) => {
    // Given
    const window = createAppWindow({ os: 'ios', ...DEVICE_WINDOW.iPadLandscape });

    // When
    const sizeClass = WindowLayoutPolicy.getPaneSizeClass(window, areaWidth);

    // Then
    expect(sizeClass).toBe(expected);
  });

  it('영역을 재기 전에는 창 폭으로 어림한다', () => {
    // Given
    const window = createAppWindow(DEVICE_WINDOW.unfoldedInner);

    // When
    const sizeClass = WindowLayoutPolicy.getPaneSizeClass(window, null);

    // Then
    expect(sizeClass).toBe('expanded');
  });

  it.each([
    ['세로·사이드바 닫힘', DEVICE_WINDOW.iPadPortrait, 0, 'medium'],
    ['세로·사이드바 열림', DEVICE_WINDOW.iPadPortrait, IPAD_SIDEBAR_WIDTH, 'compact'],
    ['가로·사이드바 닫힘', DEVICE_WINDOW.iPadLandscape, 0, 'expanded'],
    ['가로·사이드바 열림', DEVICE_WINDOW.iPadLandscape, IPAD_SIDEBAR_WIDTH, 'expanded'],
    [
      '반쪽 Split View·사이드바 열림',
      DEVICE_WINDOW.iPadHalfSplitView,
      IPAD_SIDEBAR_WIDTH,
      'compact',
    ],
  ] as const)('iPad %s이면 %s다', (_state, size, sidebarWidth, expected) => {
    // Given
    const window = createAppWindow({ os: 'ios', ...size });
    // 사이드바가 열리면 탭 안 영역은 창 폭에서 사이드바 폭만큼 좁다
    const areaWidth = size.width - sidebarWidth;

    // When
    const sizeClass = WindowLayoutPolicy.getPaneSizeClass(window, areaWidth);

    // Then
    expect(sizeClass).toBe(expected);
  });

  it('Mac 창은 영역이 넓어도 compact다', () => {
    // Given
    const window = createAppWindow({ os: 'ios', isDesktop: true, width: 1366, height: 1024 });

    // When
    const sizeClass = WindowLayoutPolicy.getPaneSizeClass(window, 1366);

    // Then
    expect(sizeClass).toBe('compact');
  });
});

describe('WindowLayoutPolicy.getPaneColumns', () => {
  it('좁은 영역은 한 칸이고 목록이 영역 폭을 다 쓴다', () => {
    // Given
    const window = createAppWindow({ os: 'ios', ...DEVICE_WINDOW.iPadPortrait });
    const area = { width: DEVICE_WINDOW.iPadPortrait.width - IPAD_SIDEBAR_WIDTH, foldX: null };

    // When
    const columns = WindowLayoutPolicy.getPaneColumns(window, area);

    // Then
    expect(columns).toEqual({ isSplit: false, primaryWidth: 500 });
  });

  it('영역을 재기 전 한 칸이면 목록 폭을 창 폭으로 어림한다', () => {
    // Given
    const window = createAppWindow(DEVICE_WINDOW.foldedOuter);

    // When
    const columns = WindowLayoutPolicy.getPaneColumns(window, { width: null, foldX: null });

    // Then
    expect(columns).toEqual({ isSplit: false, primaryWidth: DEVICE_WINDOW.foldedOuter.width });
  });

  it.each([
    [600, 320],
    [839, 320],
    [840, 400],
    [DEVICE_WINDOW.tablet.width, 400],
  ])('영역 폭 %d이면 두 칸이고 목록은 %d다', (areaWidth, expected) => {
    // Given
    const window = createAppWindow(DEVICE_WINDOW.tablet);

    // When
    const columns = WindowLayoutPolicy.getPaneColumns(window, { width: areaWidth, foldX: null });

    // Then
    expect(columns).toEqual({ isSplit: true, primaryWidth: expected });
  });

  it('반쯤 접어 세로 접힘선이 있으면 목록을 접힘선 앞면 폭에 맞춘다', () => {
    // Given
    const window = createAppWindow(DEVICE_WINDOW.unfoldedInner);
    // Pixel Fold 안쪽 화면 가운데 접힘선
    const foldX = 412;

    // When
    const columns = WindowLayoutPolicy.getPaneColumns(window, {
      width: DEVICE_WINDOW.unfoldedInner.width,
      foldX,
    });

    // Then
    expect(columns).toEqual({ isSplit: true, primaryWidth: foldX });
  });
});

describe('WindowLayoutPolicy.getOrientationLock', () => {
  it.each([
    ['휴대폰 세로', DEVICE_WINDOW.phone, 'portrait'],
    ['접은 바깥 화면', DEVICE_WINDOW.foldedOuter, 'portrait'],
    ['좁은 바깥 화면', DEVICE_WINDOW.narrowFoldedOuter, 'portrait'],
    ['펼친 안쪽 화면', DEVICE_WINDOW.unfoldedInner, 'unlocked'],
    ['태블릿', DEVICE_WINDOW.tablet, 'unlocked'],
    ['Surface Duo 한 화면', DEVICE_WINDOW.duoSingleScreen, 'portrait'],
    ['Surface Duo 두 화면에 펼침', DEVICE_WINDOW.duoSpanned, 'unlocked'],
    ['휴대폰 분할 화면 한쪽 창', DEVICE_WINDOW.phoneSplitScreenHalf, 'portrait'],
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

describe('WindowLayoutPolicy.isShortWindow', () => {
  it.each([
    ['접은 iPhone Duo', DEVICE_WINDOW.iPhoneDuoFolded, true],
    ['iPhone SE', DEVICE_WINDOW.iPhoneSe, true],
    ['휴대폰 분할 화면 한쪽 창', DEVICE_WINDOW.phoneSplitScreenHalf, true],
    ['iPhone mini', DEVICE_WINDOW.iPhoneMini, false],
    ['Surface Duo 한 화면', DEVICE_WINDOW.duoSingleScreen, false],
    ['휴대폰', DEVICE_WINDOW.phone, false],
  ] as const)('%s 창은 낮은 창 %s다', (_device, size, expected) => {
    // Given
    const window = createAppWindow(size);

    // When
    const isShort = WindowLayoutPolicy.isShortWindow(window);

    // Then
    expect(isShort).toBe(expected);
  });

  it.each([
    [719, true],
    [720, false],
  ] as const)('창 높이 %d이면 낮은 창 %s다', (height, expected) => {
    // Given
    const window = createAppWindow({ height });

    // When
    const isShort = WindowLayoutPolicy.isShortWindow(window);

    // Then
    expect(isShort).toBe(expected);
  });
});
