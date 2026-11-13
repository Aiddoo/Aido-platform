import {
  useAppLifecycle,
  useLogger,
  useStoreReviewService,
} from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

import { STORE_REVIEW_LOG_EVENT } from '../constants/store-review-log-events';
import type { StoreReviewMoment } from '../domains/store-review.model';
import { waitForSettledScreen } from '../utils/wait-for-settled-screen';

// 기다리는 동안 순간을 만든 화면이 내려가거나 시트·키보드가 올라오거나 앱이 백그라운드로 가면 요청하지 않는다
export function useStoreReviewMoment() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const logger = useLogger();
  const appLifecycle = useAppLifecycle();
  const storeReviewService = useStoreReviewService();
  const { trackEvent } = useTrack();
  const todayKey = useTodayKey();
  const pendingRequestRef = useRef<AbortController | null>(null);

  // 화면이 내려가면 기다리던 요청의 타이머·AppState 구독을 정리한다
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

  /** 실패는 안에서 기록하고 삼킨다. 호출부는 기다리지 않아도 된다 */
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
        if (outcome === 'requested') {
          trackEvent('store_review_requested', { moment });
        }
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
    [appLifecycle, logger, navigation, queryClient, storeReviewService, trackEvent],
  );

  return { recordActiveDay, requestReviewAt };
}
