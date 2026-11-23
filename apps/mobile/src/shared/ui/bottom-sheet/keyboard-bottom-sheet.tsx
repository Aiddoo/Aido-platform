import { BottomSheet as HeroBottomSheet } from 'heroui-native';
import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { ScrollView, type ScrollViewInstance, useWindowDimensions } from 'react-native';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SHARED_SHEET_STYLES, SHEET_CONTENT_PADDING } from './bottom-sheet.constants';
import { useSheetPresentation } from './use-sheet-presentation';
import { useSheetSurface } from './use-sheet-surface';

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 시트 닫기 애니메이션 시작 시 호출 (바깥 탭, 끌어내림 등) */
  onCloseStart?: () => void;
  children: ReactNode;
  /** 키보드에 가려도 보여야 하는 주 동작 버튼. 칩 줄 등 나머지는 children 흐름에 둔다 */
  footer?: ReactNode;
  /** 시트 면 위, 내용 뒤에 까는 장식 */
  backgroundDecoration?: ReactNode;
  /** 내용이 안쪽 스크롤을 직접 둘 때(빠른 말하기 자막) 끄면 시트를 끌어 움직이지 않는다. 닫기는 버튼·뒤로 가기로 한다 */
  isDraggable?: boolean;
  /** 끌어내림·Android 뒤로 가기에서 닫기 전에 할 일. 넘기면 시트가 스스로 닫히지 않는다(바깥 탭은 받지 않는다) */
  onDismissRequest?: () => void;
}

/** 포커스한 입력이 오류 문구 한 줄까지 키보드·footer 위에 보이는 간격 */
const FOCUSED_INPUT_KEYBOARD_GAP = 24;
const SHEET_TOP_GAP = 24;
const ANDROID_GRABBER_INSET = 32;

/** 키보드 컨트롤러는 전역이라 마지막으로 닫히는 시트만 다시 켠다 */
let openSheetCount = 0;

// keyboardShouldPersistTaps가 'always'인 것은 키보드가 떠 있을 때 첫 탭이 키보드를 내리는 데 먹혀 버튼을 두 번 눌러야 하기 때문이다
export function KeyboardBottomSheet({
  isOpen,
  onOpenChange,
  onCloseStart,
  children,
  footer,
  backgroundDecoration,
  isDraggable = true,
  onDismissRequest,
}: KeyboardBottomSheetProps) {
  const { setEnabled } = useKeyboardContext();
  const scrollableRef = useRef<ScrollViewInstance>(null);
  const { sheetRef, onWillDismiss, onDidDismiss } = useSheetPresentation({
    isOpen,
    onOpenChange,
    onCloseStart,
  });
  const surface = useSheetSurface();

  // 시트가 키보드를 네이티브로 따라가므로 화면용 키보드 컨트롤러가 같은 insets를 함께 다루지 않게 끈다
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    openSheetCount += 1;
    setEnabled(false);
    return () => {
      openSheetCount -= 1;
      if (openSheetCount === 0) {
        setEnabled(true);
      }
    };
  }, [isOpen, setEnabled]);

  return (
    <HeroBottomSheet
      {...surface}
      ref={sheetRef}
      background={backgroundDecoration}
      scrollableRef={scrollableRef}
      scrollableOptions={{ keyboardScrollOffset: FOCUSED_INPUT_KEYBOARD_GAP }}
      footerOptions={{ position: 'absolute' }}
      draggable={isDraggable}
      dismissible={onDismissRequest == null}
      onDismissAttempt={() => onDismissRequest?.()}
      onWillDismiss={onWillDismiss}
      onDidDismiss={onDidDismiss}
    >
      <HeroBottomSheet.Content style={SHARED_SHEET_STYLES.container}>
        <ScrollView
          ref={scrollableRef}
          contentContainerStyle={SHARED_SHEET_STYLES.body}
          keyboardShouldPersistTaps="always"
          bounces={false}
        >
          {children}
        </ScrollView>
        {footer != null && (
          <HeroBottomSheet.Footer
            isSticky
            style={[SHARED_SHEET_STYLES.footer, { backgroundColor: surface.backgroundColor }]}
          >
            {footer}
          </HeroBottomSheet.Footer>
        )}
      </HeroBottomSheet.Content>
    </HeroBottomSheet>
  );
}

/** 내용이 안쪽 스크롤을 직접 둘 때(빠른 말하기 자막) 넘지 않을 높이. 시트 위 간격·손잡이·위아래 여백·safe area를 뺀다 */
export function useKeyboardSheetBodyMaxHeight(): number {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const contentPaddingTop =
    process.env.EXPO_OS === 'android' ? ANDROID_GRABBER_INSET : SHEET_CONTENT_PADDING;

  return (
    windowHeight -
    insets.top -
    SHEET_TOP_GAP -
    contentPaddingTop -
    SHEET_CONTENT_PADDING -
    insets.bottom
  );
}
