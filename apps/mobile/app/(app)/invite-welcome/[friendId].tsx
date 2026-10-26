import { InviteWelcomeBottomSheet } from '@src/features/invite/components/invite-welcome-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

// 친구 탭 Stack 안에 두면 시트 뒤가 빈 화면이 되어, 탭 위에 뜨도록 앱 루트 시트 route로 둔다.
// param은 시트가 읽고, 형식이 틀리면 보여 줄 결과가 없어 시트가 피드로 닫는다
export default function InviteWelcomeSheetRoute() {
  return (
    <SheetRouteScreen>
      <InviteWelcomeBottomSheet />
    </SheetRouteScreen>
  );
}
