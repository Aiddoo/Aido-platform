import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

// heroui BottomSheet는 TrueSheet의 reanimated 시트를 쓴다. 공식 mock은 늘 내용을 그리고 ref 메서드가 아무 이벤트도 보내지 않아,
// 열고 닫히는 흐름(닫힘 뒤 route 떠나기·토스트 옮기기)을 볼 수 있게 열림 상태와 생명주기 이벤트를 흉내 낸다

interface SheetEvent {
  nativeEvent: null;
}

interface PresentingSheetProps {
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  background?: ReactNode;
  dismissible?: boolean;
  onWillPresent?: (event: SheetEvent) => void;
  onDidPresent?: (event: SheetEvent) => void;
  onWillDismiss?: (event: SheetEvent) => void;
  onDidDismiss?: (event: SheetEvent) => void;
  onDismissAttempt?: (event: SheetEvent) => void;
}

const SHEET_EVENT: SheetEvent = { nativeEvent: null };

/** 지금 떠 있는 시트. 나중에 연 시트가 끝에 있다 */
const presentedSheets: ReanimatedTrueSheet[] = [];

interface PresentingSheetState {
  isPresented: boolean;
  hasPresented: boolean;
}

/** 닫혀도 한 번 연 내용은 남긴다. 닫힘 애니메이션 동안 다시 누르는 흐름(두 번 제출)을 테스트가 볼 수 있게 한다 */
export class ReanimatedTrueSheet extends Component<PresentingSheetProps, PresentingSheetState> {
  override state = { isPresented: false, hasPresented: false };

  present = async () => {
    if (this.state.isPresented) {
      return;
    }
    this.props.onWillPresent?.(SHEET_EVENT);
    presentedSheets.push(this);
    this.setState({ isPresented: true, hasPresented: true });
    this.props.onDidPresent?.(SHEET_EVENT);
  };

  dismiss = async () => {
    this.#finishDismiss();
  };

  dismissStack = async () => {};

  resize = async () => {};

  /** 끌어내림·뒤로 가기. `dismissible`이 꺼져 있으면 닫지 않고 시도만 알린다 */
  dismissByUser() {
    if (this.props.dismissible === false) {
      this.props.onDismissAttempt?.(SHEET_EVENT);
      return;
    }
    this.#finishDismiss();
  }

  startDismissByUser() {
    this.props.onWillDismiss?.(SHEET_EVENT);
  }

  override componentWillUnmount() {
    removePresentedSheet(this);
  }

  override render() {
    if (!this.state.hasPresented) {
      return null;
    }
    const { background, header, children, footer } = this.props;

    // 네이티브처럼 머리글·내용·footer를 각자의 칸에 둔다. 내용의 aria-modal이 footer 버튼을 접근성에서 가리지 않는다
    return (
      <View>
        <View>{background}</View>
        <View>{header}</View>
        <View>{children}</View>
        <View>{footer}</View>
      </View>
    );
  }

  #finishDismiss() {
    if (!this.state.isPresented) {
      return;
    }
    this.props.onWillDismiss?.(SHEET_EVENT);
    removePresentedSheet(this);
    this.setState({ isPresented: false });
    this.props.onDidDismiss?.(SHEET_EVENT);
  }
}

export function ReanimatedTrueSheetProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useReanimatedTrueSheet() {
  return {
    animatedPosition: useSharedValue(0),
    animatedIndex: useSharedValue(-1),
    animatedDetent: useSharedValue(0),
  };
}

function removePresentedSheet(sheet: ReanimatedTrueSheet) {
  const index = presentedSheets.indexOf(sheet);
  if (index !== -1) {
    presentedSheets.splice(index, 1);
  }
}

function getTopSheet() {
  const sheet = presentedSheets.at(-1);
  if (sheet == null) {
    throw new Error('떠 있는 시트가 없습니다');
  }
  return sheet;
}

/** 맨 위 시트를 사용자가 끌어 내려 닫기 시작한 순간(onWillDismiss)까지만 흉내 낸다 */
export function startDismissingTopSheet() {
  getTopSheet().startDismissByUser();
}

/** 맨 위 시트를 사용자가 끌어 내려 닫는다 */
export function dismissTopSheetByUser() {
  getTopSheet().dismissByUser();
}
