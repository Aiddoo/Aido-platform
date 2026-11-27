import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { useTranslation } from '@src/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';

import { findFriendLimit, getFriendLimit } from '../domains/friend.error';

interface FriendLimitPromptOptions {
  /** 친구 한도 안내에 덧붙일 "초대로 자리 늘리기" 길. 초대를 쓸 수 없으면 넘기지 않는다 */
  onFriendLimitInvite?: () => void;
}

/** 친구 요청이 한도(FOLLOW_0909)에 막혔으면 한도 안내를 띄운다. 친구 추가와 검색 결과가 같은 안내를 쓴다 */
export function useFriendLimitPrompt({ onFriendLimitInvite }: FriendLimitPromptOptions) {
  const { t } = useTranslation('invite');
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const gate = useEntitlementGate('FRIEND', { surface: 'friend_request' });

  return (error: unknown) => {
    if (!isLimitedFeatureError(error)) {
      return;
    }
    haptics.notify('error');
    const snapshot = getCachedEntitlements(queryClient);
    const knownLimit = snapshot == null ? null : EntitlementPolicy.findLimit(snapshot, 'FRIEND');
    gate.promptIfBlockedError(
      error,
      onFriendLimitInvite == null
        ? {}
        : {
            description: t('entry.friendLimitDescription', {
              limit: getFriendLimit({ serverLimit: findFriendLimit(error), knownLimit }),
              activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
            }),
            alternativeAction: {
              label: t('entry.growFriendLimit'),
              onPress: onFriendLimitInvite,
            },
          },
    );
  };
}
