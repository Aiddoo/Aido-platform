import { InviteWelcomeBottomSheet } from '@src/features/social/invite/components/invite-welcome-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

// 친구 탭 Stack 안에 두면 시트 뒤가 빈 화면이 되어, 탭 위에 뜨도록 앱 루트 시트 route로 둔다
export default function InviteWelcomeSheetScreen() {
  return (
    <SheetRouteScreen>
      <InviteWelcomeBottomSheet />
    </SheetRouteScreen>
  );
}
