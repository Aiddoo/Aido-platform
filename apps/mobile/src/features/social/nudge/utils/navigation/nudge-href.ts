import type { NudgeReceiver } from '../../components/nudge-bottom-sheet';

/** 친구에게 독촉 콕을 보내는 시트. 어느 화면에서 열어도 같은 시트가 뜨도록 사람 기준 route로 연다 */
export function remindNudgeSheetHref({ id, displayName }: NudgeReceiver) {
  return { pathname: '/users/[userId]/nudge', params: { userId: id, name: displayName } } as const;
}
