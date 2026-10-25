import { friendScreenParamsSchema } from '@src/features/friend/hooks/use-friend-screen-params';
import { InviteWelcomeBottomSheet } from '@src/features/invite/components/invite-welcome-bottom-sheet';
import { createFeedHref } from '@src/features/todo/utils/feed-route';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

// 친구 탭 Stack 안에 두면 시트 뒤가 빈 화면이 되어, 탭 위에 뜨도록 앱 루트 시트 route로 둔다
export default function InviteWelcomeSheetRoute() {
  const params = friendScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href={createFeedHref()} />;
  }

  return (
    <SheetRouteScreen>
      <InviteWelcomeBottomSheet />
    </SheetRouteScreen>
  );
}
