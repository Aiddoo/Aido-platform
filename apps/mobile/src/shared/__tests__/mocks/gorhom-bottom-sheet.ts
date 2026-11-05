import type { ComponentType } from 'react';

const actual = require('@gorhom/bottom-sheet/mock');

interface GorhomSheetProps {
  onChange: (index: number) => void;
  onClose: () => void;
  backgroundComponent: ComponentType<{ pointerEvents: 'none' }>;
  backdropComponent: unknown;
}

let lastProps: GorhomSheetProps | null = null;

/** 공식 mock 그대로에, gorhom이 네이티브에서 부르는 콜백을 테스트가 대신 부를 수 있게 마지막 props를 남긴다 */
class RecordingBottomSheet extends actual.default {
  render() {
    lastProps = this.props;
    return super.render();
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
  getLastGorhomSheetProps,
};
