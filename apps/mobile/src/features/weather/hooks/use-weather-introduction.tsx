import {
  useLogger,
  usePendingRedemptionService,
  useWeatherIntroductionRepository,
} from '@src/bootstrap/providers/di-context';
import { getNowInstant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { useWeatherLocation } from './use-weather-location';

/** 위치 권한을 아직 묻지 않은 사용자에게 피드에서 한 번만 날씨 위치 등록을 권한다 */
export function useWeatherIntroduction({
  isStable,
}: {
  isStable: boolean;
}): readonly [{ isPending: boolean }] {
  const location = useWeatherLocation();
  const introductionRepository = useWeatherIntroductionRepository();
  const pendingRedemptionService = usePendingRedemptionService();
  const logger = useLogger();
  const overlay = useOverlay();
  const { t } = useTranslation(['weather']);
  const hasSeen = useSyncExternalStore(
    introductionRepository.subscribe,
    introductionRepository.hasSeenIntroduction,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const hasClaimedRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const shouldIntroduce = location.status === 'needsPermission' && !hasSeen;
  const request = location.status === 'needsPermission' ? location.request : null;

  // 다이얼로그 답이나 권한 요청이 화면이 사라진 뒤에 끝나도 상태를 바꾸지 않는다
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!isStable || !shouldIntroduce || request == null) {
      return;
    }
    const task = requestIdleCallback(() => {
      if (
        hasClaimedRef.current ||
        pendingRedemptionService.findFreshPendingRedemption(getNowInstant()) != null
      ) {
        return;
      }
      hasClaimedRef.current = true;
      overlay
        .openAsync<boolean | null>(
          ({ isOpen, close, unmount }) => (
            <ConfirmDialog
              isOpen={isOpen}
              onOpenChange={(open) => {
                if (!open) {
                  close(false);
                  unmount();
                }
              }}
              title={<ConfirmDialog.Title>{t('weather:introduction.title')}</ConfirmDialog.Title>}
              description={
                <ConfirmDialog.Description>
                  {t('weather:introduction.description')}
                </ConfirmDialog.Description>
              }
              cancelButton={
                <ConfirmDialog.CancelButton
                  onPress={() => {
                    close(false);
                    unmount();
                  }}
                >
                  {t('weather:introduction.later')}
                </ConfirmDialog.CancelButton>
              }
              confirmButton={
                <ConfirmDialog.ConfirmButton
                  onPress={() => {
                    close(true);
                    unmount();
                  }}
                >
                  {t('weather:locationPrompt.register')}
                </ConfirmDialog.ConfirmButton>
              }
            />
          ),
          { dismissedValue: null },
        )
        .then((accepted) => {
          if (accepted == null) {
            hasClaimedRef.current = false;
            return undefined;
          }
          introductionRepository.markIntroductionSeen();
          if (!accepted || isUnmountedRef.current) {
            return undefined;
          }
          setIsRequesting(true);
          return request().finally(() => {
            if (!isUnmountedRef.current) {
              setIsRequesting(false);
            }
          });
        })
        .catch((error) => {
          logger.warn(WEATHER_LOG_EVENT.INTRODUCTION_FAILED, { error: getErrorMessage(error) });
        });
    });
    return () => cancelIdleCallback(task);
  }, [
    introductionRepository,
    pendingRedemptionService,
    logger,
    overlay,
    request,
    shouldIntroduce,
    isStable,
    t,
  ]);

  return [
    { isPending: location.status === 'checking' || shouldIntroduce || isRequesting },
  ] as const;
}
