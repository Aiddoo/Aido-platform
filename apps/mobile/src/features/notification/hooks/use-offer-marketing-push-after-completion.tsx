import {
  useLogger,
  useMarketingPushPromptRepository,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
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
import { noop } from 'es-toolkit';
import { useEffect, useEffectEvent, useRef } from 'react';
import { match } from 'ts-pattern';

import { MarketingPushOptInBottomSheet } from '../components/marketing-push-opt-in-bottom-sheet';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { MarketingPushPromptPolicy } from '../domains/marketing-push-prompt.model';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';

/** null은 답 없이 사라졌을 때(로그아웃 등)라 거절로 남기지 않는다 */
type MarketingPushOfferChoice = 'agree' | 'dismiss' | null;

/** 완료 체크가 끝나는 모습을 보고 난 뒤에 시트를 올린다 */
const OFFER_DELAY_MS = 700;

/** 할 일을 처음 끝낸 순간에 혜택·소식 알림을 한 번 제안한다. 로그인한 화면 묶음에 한 번만 둔다 */
export function useOfferMarketingPushAfterCompletion() {
  const sessionEpoch = useSessionEpoch();
  const findOfferAccountId = useFindMarketingPushOfferAccountId();
  const openOffer = useOpenMarketingPushOffer();
  const hasOfferedRef = useRef(false);

  useAfterTodoCompleted(async (signal) => {
    if (hasOfferedRef.current) {
      return;
    }
    const epoch = sessionEpoch.current();
    // 읽는 사이 로그아웃했거나 화면 묶음이 내려갔으면 로그인 화면에 시트를 띄우거나 기록을 남기지 않는다
    const isCurrent = () => !signal.aborted && sessionEpoch.current() === epoch;
    const accountId = await findOfferAccountId();
    if (accountId == null || hasOfferedRef.current || !isCurrent()) {
      return;
    }
    hasOfferedRef.current = true;
    await openOffer(accountId, { isCurrent });
  });
}

/** 할 일을 끝내면 체크가 끝나는 모습을 본 뒤에 부른다. 훅이 내려가면 signal이 끊긴다 */
function useAfterTodoCompleted(onCompleted: (signal: AbortSignal) => Promise<void>) {
  const logger = useLogger();
  const handleCompleted = useEffectEvent(onCompleted);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeTodoCompletionChanged(({ isCompleted }) => {
      if (!isCompleted || timer != null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        handleCompleted(controller.signal).catch((error: unknown) =>
          logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_PUSH_OFFER_SKIPPED, {
            error: getErrorMessage(error),
          }),
        );
      }, OFFER_DELAY_MS);
    });
    return () => {
      controller.abort();
      unsubscribe();
      if (timer != null) {
        clearTimeout(timer);
      }
    };
  }, [logger]);
}

/** 제안할 계정. 기기 알림이나 앱 푸시가 꺼져 있으면 동의를 받아도 알림이 닿지 않아 제안하지 않는다 */
function useFindMarketingPushOfferAccountId() {
  const queryClient = useQueryClient();
  const repository = useMarketingPushPromptRepository();
  const logger = useLogger();
  const consentQueryOptions = useGetConsentQueryOptions();
  const preferenceQueryOptions = useGetPreferenceQueryOptions();
  const permissionQueryOptions = useGetPushPermissionQueryOptions();

  return async (): Promise<string | null> => {
    const me = getCachedMe(queryClient);
    if (me == null) {
      return null;
    }
    const logSkipped = (error: unknown) =>
      logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_PUSH_OFFER_SKIPPED, {
        error: getErrorMessage(error),
      });
    // 설정 화면을 열지 않았어도 제안할 수 있게 캐시가 없으면 받아 온다
    const [preference, consent, permission] = await Promise.all([
      // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
      queryClient.ensureQueryData(preferenceQueryOptions).catch((error: unknown) => {
        logSkipped(error);
        return null;
      }),
      readWithoutBlocking(
        // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
        queryClient.getQueryData(consentQueryOptions.queryKey),
        // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
        () => queryClient.ensureQueryData(consentQueryOptions),
        logSkipped,
      ),
      // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
      queryClient.ensureQueryData(permissionQueryOptions),
    ]);
    if (
      preference == null ||
      consent == null ||
      !PushPermissionPolicy.canReceivePush(permission, preference) ||
      !MarketingPushPromptPolicy.shouldPrompt(consent, repository.find(me.id), getNowInstant())
    ) {
      return null;
    }
    return me.id;
  };
}

/** 시트를 띄우고 고른 답을 남긴다. 동의 뒤 닫히는 애니메이션도 닫힘을 알리므로 처음 고른 답 하나만 남긴다 */
function useOpenMarketingPushOffer() {
  const overlay = useOverlay();
  const repository = useMarketingPushPromptRepository();
  const { trackEvent } = useTrack();

  return async (accountId: string, { isCurrent }: { isCurrent: () => boolean }) => {
    trackEvent('marketing_push_prompt_shown', { source: 'completion_sheet' });
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
        // 시트가 떠 있는 사이 세션이 끝났으면 끝난 계정에 거절 시각을 남기지 않는다
        if (!isCurrent()) {
          return;
        }
        repository.dismiss(accountId, getNowInstant());
        trackEvent('marketing_push_prompt_dismissed', { source: 'completion_sheet' });
      })
      .with(null, noop)
      .exhaustive();
  };
}
