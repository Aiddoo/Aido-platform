import {
  getPercentIndex,
  getProgressRowStart,
  getScrollProgress,
  getScrollProgressState,
  getTrackWidth,
  shouldReportPercent,
} from './scroll-progress.geometry';

function scrollEvent(offsetY: number, contentHeight: number, viewportHeight: number) {
  return {
    contentOffset: { y: offsetY },
    contentSize: { height: contentHeight },
    layoutMeasurement: { height: viewportHeight },
  };
}

describe('getScrollProgress', () => {
  it.each([
    ['맨 위', 0, 0],
    ['절반', 500, 0.5],
    ['맨 끝', 1000, 1],
    ['당겨서 새로고침으로 위로 넘침', -80, 0],
    ['끝에서 튕겨 넘침', 1100, 1],
  ] as const)('%s(%i)이면 %d다', (_case, offsetY, expected) => {
    // When
    const progress = getScrollProgress(scrollEvent(offsetY, 1800, 800));

    // Then
    expect(progress).toBe(expected);
  });

  it('내용이 화면보다 짧으면 0이다', () => {
    // When
    const progress = getScrollProgress(scrollEvent(20, 600, 800));

    // Then
    expect(progress).toBe(0);
  });
});

describe('getScrollProgressState', () => {
  it.each([
    [0, 'hidden'],
    [0.01, 'scrolling'],
    [0.99, 'scrolling'],
    [1, 'end'],
  ] as const)('%d이면 %s다', (progress, expected) => {
    // When
    const state = getScrollProgressState(progress);

    // Then
    expect(state).toBe(expected);
  });
});

describe('getPercentIndex', () => {
  it.each([
    [0, 0],
    [0.004, 0],
    [0.005, 1],
    [0.5, 50],
    [1, 100],
    [1.2, 100],
    [-0.1, 0],
  ] as const)('%d이면 %i칸이다', (progress, expected) => {
    // When
    const index = getPercentIndex(progress);

    // Then
    expect(index).toBe(expected);
  });
});

describe('막대 자리', () => {
  it('펼친 면(180)에서 원래 RN 배치처럼 글자 칸 44와 트랙(막대 안쪽 152의 60%)을 가운데 둔다', () => {
    // When
    const trackWidth = getTrackWidth(180);
    const rowStart = getProgressRowStart(180, 180, 44);

    // Then
    expect(trackWidth).toBeCloseTo(91.2);
    expect(rowStart).toBeCloseTo(22.4);
  });
});

describe('shouldReportPercent', () => {
  it.each([
    [1, 0, false],
    [4, 0, false],
    [5, 0, true],
    [43, 40, false],
    [45, 40, true],
    [0, 3, true],
    [100, 98, true],
    [50, 50, false],
  ] as const)('%i%%(앞서 알린 값 %i%%)이면 알리는지: %s', (percent, reportedPercent, expected) => {
    // When
    const shouldReport = shouldReportPercent(percent, reportedPercent);

    // Then
    expect(shouldReport).toBe(expected);
  });
});
