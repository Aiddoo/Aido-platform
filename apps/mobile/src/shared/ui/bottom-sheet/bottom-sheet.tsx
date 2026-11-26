import { BottomSheet as HeroBottomSheet } from 'heroui-native';
import { type ComponentRef, type ReactNode, useRef } from 'react';
import { ScrollView, type ScrollViewInstance, View } from 'react-native';

import { SHARED_SHEET_STYLES } from './bottom-sheet.constants';
import { SheetFixedHeaderContext } from './sheet-header-layout';
import { SheetScreenPositionProvider } from './sheet-screen-position';
import { useSheetPresentation } from './use-sheet-presentation';
import { useSheetSurface } from './use-sheet-surface';

interface BottomSheetProps {
  isOpen: boolean;
  /** `false`는 닫힘 애니메이션이 끝난 뒤에 와서 route를 바로 떠나도 잘리지 않는다 */
  onOpenChange?: (isOpen: boolean) => void;
  onCloseStart?: () => void;
  children: ReactNode;
  /** 내용이 길어 스크롤돼도 시트 아래에 고정되는 영역. 주 동작 버튼을 둔다. */
  footer?: ReactNode;
  /** 머리글을 고정하고 본문만 스크롤한다. 내용이 `SheetHeaderLayout`을 쓴다 */
  hasFixedHeader?: boolean;
}

export function BottomSheet({
  isOpen,
  onOpenChange,
  onCloseStart,
  children,
  footer,
  hasFixedHeader = false,
}: BottomSheetProps) {
  const scrollableRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ComponentRef<typeof View>>(null);
  const { sheetRef, onWillDismiss, onDidDismiss } = useSheetPresentation({
    isOpen,
    onOpenChange,
    onCloseStart,
  });
  const surface = useSheetSurface();

  return (
    <HeroBottomSheet
      {...surface}
      ref={sheetRef}
      scrollableRef={scrollableRef}
      onWillDismiss={onWillDismiss}
      onDidDismiss={onDidDismiss}
    >
      <HeroBottomSheet.Content ref={contentRef} style={SHARED_SHEET_STYLES.container}>
        <SheetScreenPositionProvider originRef={contentRef}>
          {hasFixedHeader ? (
            <SheetFixedHeaderContext value={scrollableRef}>
              <View style={SHARED_SHEET_STYLES.body}>{children}</View>
            </SheetFixedHeaderContext>
          ) : (
            <ScrollView
              ref={scrollableRef}
              contentContainerStyle={SHARED_SHEET_STYLES.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {children}
            </ScrollView>
          )}
        </SheetScreenPositionProvider>
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
