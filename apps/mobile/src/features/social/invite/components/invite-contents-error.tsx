import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorActions, type QueryErrorFallbackProps, Result } from '@src/shared/ui';

import { isInviteDisabledError } from '../domains/invite.error';
import { InviteLinkCard } from './invite-link-card';
import { InvitePawPrintBoard } from './invite-paw-print-board';
import { PawPrintBoardCard } from './invite-paw-print-board-card';
import { InviteShareActions } from './invite-share-actions';
import { InvitedFriendSummary } from './invited-friend-summary';

/** 초대가 꺼졌으면 블록마다 쓸 수 없음 안내를, 그 밖의 실패는 다시 시도·문의를 한 번만 보인다 */
export function InviteContentsError({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  if (isInviteDisabledError(error)) {
    return (
      <>
        <InviteLinkCard.Unavailable />
        <InviteShareActions.Unavailable />
        <PawPrintBoardCard>
          <InvitePawPrintBoard.Unavailable />
        </PawPrintBoardCard>
        <Box className="-mx-4">
          <InvitedFriendSummary.Unavailable />
        </Box>
      </>
    );
  }

  return (
    <Box className="min-h-[320px] justify-center">
      <Result title={t('result.loadFailed.title')} button={<QueryErrorActions onRetry={reset} />} />
    </Box>
  );
}
