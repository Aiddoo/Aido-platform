import { useLogger, useMarketingPushPromptRepository } from '@src/bootstrap/providers/di-context';
import { subscribeTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { readWithoutBlocking } from '@src/features/identity/consent/hooks/use-ai-data-sharing-consent-gate';
import { useGetConsentQueryOptions } from '@src/features/identity/consent/queries/consent.queries';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { useOverlay } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useRef } from 'react';
import { match } from 'ts-pattern';

import { MarketingPushOptInBottomSheet } from '../components/marketing-push-opt-in-bottom-sheet';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { MarketingPushPromptPolicy } from '../domains/marketing-push-prompt.model';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';

/** null은 답 없이 사라졌을 때(로그아웃 등)라 거절로 남기지 않는다 */
type MarketingPushOfferChoice = 'agree' | 'dismiss' | null;

/** 완료 체크가 끝나는 모습을 보고 난 뒤에 시트를 올린다 */
const OFFER_DELAY_MS = 700;

/** 할 일을 처음 끝낸 순간에 혜택·소식 알림을 한 번 제안한다. 로그인한 화면 묶음에 한 번만 둔다 */
export function useOfferMarketingPushAfterCompletion() {
  const queryClient = useQueryClient();
  const overlay = useOverlay();
  const repository = useMarketingPushPromptRepository();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const consentQueryOptions = useGetConsentQueryOptions();
  const preferenceQueryOptions = useGetPreferenceQueryOptions();
  const permissionQueryOptions = useGetPushPermissionQueryOptions();
  const hasOfferedRef = useRef(false);

  const offer = useEffectEvent(async () => {
    const me = getCachedMe(queryClient);
    if (hasOfferedRef.current || me == null) {
      return;
    }
    // 설정 화면을 열지 않았어도 제안할 수 있게 캐시가 없으면 받아 온다
    const [preference, consent, permission] = await Promise.all([
      queryClient.ensureQueryData(preferenceQueryOptions).catch((error: unknown) => {
        logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_PUSH_OFFER_SKIPPED, {
          error: getErrorMessage(error),
        });
        return null;
      }),
      readWithoutBlocking(
        queryClient.getQueryData(consentQueryOptions.queryKey),
        () => queryClient.ensureQueryData(consentQueryOptions),
        (error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_PUSH_OFFER_SKIPPED, {
            error: getErrorMessage(error),
          }),
      ),
      queryClient.ensureQueryData(permissionQueryOptions),
    ]);
    // 기기 알림이나 앱 푸시가 꺼져 있으면 동의를 받아도 알림이 닿지 않는다
    if (
      preference == null ||
      consent == null ||
      hasOfferedRef.current ||
      !PushPermissionPolicy.canReceivePush(permission, preference) ||
      !MarketingPushPromptPolicy.shouldPrompt(consent, repository.find(me.id), getNowInstant())
    ) {
      return;
    }
    hasOfferedRef.current = true;
    trackEvent('marketing_push_prompt_shown', { source: 'completion_sheet' });
    // 동의 뒤 닫히는 애니메이션도 닫힘을 알리므로 처음 고른 답 하나만 남긴다
    const choice = await overlay.openAsync<MarketingPushOfferChoice>(
      ({ isOpen, close, unmount }) => (
        <MarketingPushOptInBottomSheet
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close('dismiss');
            }
          }}
          onExit={unmount}
          onAgree={() => close('agree')}
        />
      ),
      { dismissedValue: null },
    );
    match(choice)
      .with('agree', () => trackEvent('marketing_push_opted_in', { source: 'completion_sheet' }))
      .with('dismiss', () => {
        repository.dismiss(me.id, getNowInstant());
        trackEvent('marketing_push_prompt_dismissed', { source: 'completion_sheet' });
      })
      .with(null, () => undefined)
      .exhaustive();
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeTodoCompletionChanged(({ isCompleted }) => {
      if (!isCompleted || timer != null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        offer().catch((error: unknown) =>
          logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_PUSH_OFFER_SKIPPED, {
            error: getErrorMessage(error),
          }),
        );
      }, OFFER_DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (timer != null) {
        clearTimeout(timer);
      }
    };
  }, [logger]);
}
