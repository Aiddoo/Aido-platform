import {
  type MeasureInWindowOnSuccessCallback,
  type MeasureOnSuccessCallback,
  View,
} from 'react-native';

interface MeasuredLayout {
  /** `measure` 콜백 인자(x, y, width, height, pageX, pageY) */
  measure?: Parameters<MeasureOnSuccessCallback>;
  /** `measureInWindow` 콜백 인자(x, y, width, height) */
  measureInWindow?: Parameters<MeasureInWindowOnSuccessCallback>;
}

function spyMeasure() {
  return jest.spyOn(View.prototype, 'measure');
}

function spyMeasureInWindow() {
  return jest.spyOn(View.prototype, 'measureInWindow');
}

type MeasureImplementation = ReturnType<ReturnType<typeof spyMeasure>['getMockImplementation']>;
type MeasureInWindowImplementation = ReturnType<
  ReturnType<typeof spyMeasureInWindow>['getMockImplementation']
>;

/**
 * 테스트에는 레이아웃이 없어 자리를 재는 메뉴·말풍선이 열리지 않는다. describe 안 테스트마다 View의 `measure`·
 * `measureInWindow`가 정한 자리를 돌려주게 하고, 끝나면 원래 구현으로 되돌린다. RN의 두 메서드는 이미 `jest.fn`이라
 * `restoreMocks`가 되돌리지 못한다. 테스트 중에 자리를 바꾸려면 돌려준 `moveTo`를 부른다
 */
export function setupViewMeasurePerTest(layout: MeasuredLayout = {}) {
  let originalMeasure: MeasureImplementation;
  let originalMeasureInWindow: MeasureInWindowImplementation;

  function moveTo({ measure, measureInWindow }: MeasuredLayout) {
    if (measure != null) {
      spyMeasure().mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback(...measure);
        }
      });
    }
    if (measureInWindow != null) {
      spyMeasureInWindow().mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback(...measureInWindow);
        }
      });
    }
  }

  beforeEach(() => {
    originalMeasure = spyMeasure().getMockImplementation();
    originalMeasureInWindow = spyMeasureInWindow().getMockImplementation();
    moveTo(layout);
  });

  afterEach(() => {
    const measure = spyMeasure();
    const measureInWindow = spyMeasureInWindow();
    measure.mockReset();
    measureInWindow.mockReset();
    if (originalMeasure != null) {
      measure.mockImplementation(originalMeasure);
    }
    if (originalMeasureInWindow != null) {
      measureInWindow.mockImplementation(originalMeasureInWindow);
    }
  });

  return { moveTo };
}
