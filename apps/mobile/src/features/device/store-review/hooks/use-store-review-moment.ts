import {
  useAppLifecycle,
  useLogger,
  useStoreReviewService,
} from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { getErrorMessage } from '@src/shared/errors';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

import { STORE_REVIEW_LOG_EVENT } from '../constants/store-review-log-events';
import type { StoreReviewMoment } from '../domains/store-review.model';
import { waitForSettledScreen } from '../utils/wait-for-settled-screen';

/** 긍정적인 순간에 OS 리뷰 창을 요청한다 */
export function useStoreReviewMoment() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const logger = useLogger();
  const appLifecycle = useAppLifecycle();
  const storeReviewService = useStoreReviewService();
  const todayKey = useTodayKey();
  const pendingRequestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      pendingRequestRef.current?.abort();
      pendingRequestRef.current = null;
    },
    [],
  );

  const recordActiveDay = useCallback(() => {
    const accountId = getCachedMe(queryClient)?.id;
    if (accountId == null) {
      return;
    }
    try {
      storeReviewService.recordActiveDay(accountId, todayKey);
    } catch (error) {
      logger.warn(STORE_REVIEW_LOG_EVENT.REQUEST_FAILED, {
        step: 'record_active_day',
        error: getErrorMessage(error),
      });
    }
  }, [todayKey, logger, queryClient, storeReviewService]);

  const requestReviewAt = useCallback(
    async (moment: StoreReviewMoment): Promise<void> => {
      const accountId = getCachedMe(queryClient)?.id;
      // 이미 기다리는 요청이 있으면 두 번 예약하지 않는다
      if (accountId == null || pendingRequestRef.current != null) {
        return;
      }
      const controller = new AbortController();
      pendingRequestRef.current = controller;
      try {
        const outcome = await storeReviewService.requestReviewAt({ accountId, moment }, (delayMs) =>
          waitForSettledScreen({
            delayMs,
            signal: controller.signal,
            appLifecycle,
            isScreenReady: () => navigation.isFocused() && !Keyboard.isVisible(),
          }),
        );
        logger.debug(STORE_REVIEW_LOG_EVENT.REQUEST_SETTLED, { moment, outcome });
      } catch (error) {
        logger.warn(STORE_REVIEW_LOG_EVENT.REQUEST_FAILED, {
          moment,
          error: getErrorMessage(error),
        });
      } finally {
        if (pendingRequestRef.current === controller) {
          pendingRequestRef.current = null;
        }
      }
    },
    [appLifecycle, logger, navigation, queryClient, storeReviewService],
  );

  return { recordActiveDay, requestReviewAt };
}
