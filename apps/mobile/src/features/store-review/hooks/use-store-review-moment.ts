import { useLogger, useStoreReviewService } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { toError } from '@src/shared/errors';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Keyboard } from 'react-native';

import { STORE_REVIEW_LOG_EVENT } from '../constants/store-review-log-events';
import type { StoreReviewMoment } from '../domains/store-review.model';
import { waitForSettledScreen } from '../utils/wait-for-settled-screen';

/**
 * 긍정적인 순간에 OS 리뷰 창을 요청한다. 순간을 만든 화면 안에서 쓰며,
 * 기다리는 동안 그 화면이 내려가거나 시트·키보드가 올라오거나 앱이 백그라운드로 가면 요청하지 않는다.
 *
 * 새 순간은 `StoreReviewMoment`에 추가한 뒤 축하가 보이는 곳에서 `requestReviewAt('…')` 한 줄로 연결한다.
 */
export function useStoreReviewMoment() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const logger = useLogger();
  const storeReviewService = useStoreReviewService();
  const { currentLocalDateKey } = useLocalDate();
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
      storeReviewService.recordActiveDay(accountId, currentLocalDateKey);
    } catch (error) {
      logger.warn(STORE_REVIEW_LOG_EVENT.REQUEST_FAILED, { error: toError(error).message });
    }
  }, [currentLocalDateKey, logger, queryClient, storeReviewService]);

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
            appState: AppState,
            isScreenReady: () => navigation.isFocused() && !Keyboard.isVisible(),
          }),
        );
        logger.debug(STORE_REVIEW_LOG_EVENT.REQUEST_SETTLED, { moment, outcome });
      } catch (error) {
        logger.warn(STORE_REVIEW_LOG_EVENT.REQUEST_FAILED, {
          moment,
          error: toError(error).message,
        });
      } finally {
        if (pendingRequestRef.current === controller) {
          pendingRequestRef.current = null;
        }
      }
    },
    [logger, navigation, queryClient, storeReviewService],
  );

  return { recordActiveDay, requestReviewAt };
}
