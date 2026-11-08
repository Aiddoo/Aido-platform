import {
  useInviteService,
  useLogger,
  useWeatherIntroductionRepository,
} from '@src/bootstrap/providers/di-context';
import { getNowInstant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { useWeatherLocation } from './use-weather-location';

/**
 * 위치 권한을 아직 묻지 않은 사용자에게 피드에서 한 번만 날씨 위치 등록을 권한다.
 * 로그인 전에 연 초대처럼 이어서 열 화면이 남아 있으면 그 이동이 끝나 피드로 돌아올 때까지 미룬다.
 * 다른 자동 안내(기능 소개)가 겹치지 않도록 안내 여부가 정해지고 OS 권한 창이 끝날 때까지 isPending을 돌려준다.
 */
export function useWeatherIntroduction({
  isStable,
}: {
  isStable: boolean;
}): readonly [{ isPending: boolean }] {
  const location = useWeatherLocation();
  const introductionRepository = useWeatherIntroductionRepository();
  const inviteService = useInviteService();
  const logger = useLogger();
  const overlay = useOverlay();
  const { t } = useTranslation(['weather']);
  const hasSeen = useSyncExternalStore(
    introductionRepository.subscribe,
    introductionRepository.hasSeenIntroduction,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const hasClaimedRef = useRef(false);
  const shouldIntroduce = location.status === 'needsPermission' && !hasSeen;
  const request = location.status === 'needsPermission' ? location.request : null;

  useEffect(() => {
    if (!isStable || !shouldIntroduce || request == null) {
      return;
    }
    const task = requestIdleCallback(() => {
      if (
        hasClaimedRef.current ||
        inviteService.findFreshPendingRedemption(getNowInstant()) != null
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
          // 답 없이 사라진 다이얼로그는 본 것이 아니다. 피드로 돌아오면 다시 권한다
          if (accepted == null) {
            hasClaimedRef.current = false;
            return undefined;
          }
          introductionRepository.markIntroductionSeen();
          if (!accepted) {
            return undefined;
          }
          setIsRequesting(true);
          return request().finally(() => setIsRequesting(false));
        })
        .catch((error) => {
          logger.warn(WEATHER_LOG_EVENT.INTRODUCTION_FAILED, { error: getErrorMessage(error) });
        });
    });
    return () => cancelIdleCallback(task);
  }, [
    introductionRepository,
    inviteService,
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
