import { t } from '@src/shared/i18n';
import type { SearchedUser } from '../../models/friend.model';

/** 검색 결과 행 액션 상태 (도메인 flag를 UI 역할로 축약해 Props 누출 방지) */
export type SearchedUserActionState = 'add' | 'pending' | 'friend';

export interface SearchedUserViewModel extends SearchedUser {
  displayName: string;
  actionState: SearchedUserActionState;
}

const resolveActionState = (user: SearchedUser): SearchedUserActionState => {
  if (user.isFriend) {
    return 'friend';
  }
  if (user.requestPending) {
    return 'pending';
  }
  return 'add';
};

export const toSearchedUserViewModel = (user: SearchedUser): SearchedUserViewModel => ({
  ...user,
  displayName: user.name ?? t('friend:fallbackName'),
  actionState: resolveActionState(user),
});
