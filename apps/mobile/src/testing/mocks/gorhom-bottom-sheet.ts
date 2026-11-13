import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { type ComponentType, createElement, Fragment, type ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

const actual = require('@gorhom/bottom-sheet/mock');

interface GorhomSheetProps {
  onChange: (index: number) => void;
  onClose: () => void;
  onAnimate: (fromIndex: number, toIndex: number) => void;
  backgroundComponent: ComponentType<{ pointerEvents: 'none' }>;
  backdropComponent: ComponentType<BottomSheetBackdropProps>;
  footerComponent?: ComponentType<object>;
  animatedIndex?: SharedValue<number>;
  animatedPosition?: SharedValue<number>;
}

let lastProps: GorhomSheetProps | null = null;

/** 시트에 부른 forceClose. clearMocks가 테스트마다 비운다 */
export const gorhomForceClose = jest.fn();

/**
 * 공식 mock은 footer를 그리지 않는다. 주 동작 버튼을 테스트가 누를 수 있게 그리고,
 * gorhom이 네이티브에서 부르는 콜백을 테스트가 대신 부를 수 있게 마지막 props를 남긴다
 */
class RecordingBottomSheet extends actual.default {
  forceClose() {
    gorhomForceClose();
  }

  render() {
    lastProps = this.props;
    const { footerComponent } = this.props;
    return createElement(
      Fragment,
      null,
      super.render(),
      footerComponent == null ? null : createElement(footerComponent),
    );
  }
}

/** 가장 최근에 그린 시트의 props */
export const getLastGorhomSheetProps = (): GorhomSheetProps => {
  if (lastProps == null) {
    throw new Error('아직 그린 시트가 없습니다');
  }
  return lastProps;
};

module.exports = {
  ...actual,
  __esModule: true,
  default: RecordingBottomSheet,
  BottomSheetFooter: ({ children }: { children: ReactNode }) => children,
  getLastGorhomSheetProps,
  gorhomForceClose,
};
