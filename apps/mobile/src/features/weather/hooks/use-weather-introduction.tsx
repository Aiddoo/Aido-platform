import {
  useInviteService,
  useLogger,
  useWeatherIntroductionService,
} from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useEffect, useRef, useState } from 'react';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { useWeatherLocation } from './use-weather-location';

/**
 * 위치 권한을 아직 묻지 않은 사용자에게 피드에서 한 번만 날씨 위치 등록을 권한다.
 * 로그인 전에 연 초대처럼 이어서 열 화면이 남아 있으면 그 이동이 끝나 피드로 돌아올 때까지 미룬다.
 * 다른 자동 안내(기능 소개)가 겹치지 않도록 안내 여부가 정해질 때까지 isPending을 돌려준다.
 */
export function useWeatherIntroduction(): { isPending: boolean } {
  const location = useWeatherLocation();
  const introductionService = useWeatherIntroductionService();
  const inviteService = useInviteService();
  const logger = useLogger();
  const stable = useStableFeedForeground();
  const overlay = useOverlay();
  const { t } = useTranslation(['weather', 'common']);
  const [hasSeen, setHasSeen] = useState(() => introductionService.hasSeenIntroduction());
  const hasClaimed = useRef(false);
  const shouldIntroduce = location.status === 'needsPermission' && !hasSeen;
  const request = location.status === 'needsPermission' ? location.request : null;

  useEffect(() => {
    if (!stable || !shouldIntroduce || request == null || hasClaimed.current) {
      return;
    }
    const task = requestIdleCallback(() => {
      if (hasClaimed.current || inviteService.findPendingRedemption(new Date()) != null) {
        return;
      }
      hasClaimed.current = true;
      overlay
        .open<boolean>(({ isOpen, close, exit }) => (
          <ConfirmDialog
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close(false);
                exit();
              }
            }}
            title={<ConfirmDialog.Title>{t('weather:locationPrompt.title')}</ConfirmDialog.Title>}
            description={
              <ConfirmDialog.Description>
                {t('weather:introduction.description')}
              </ConfirmDialog.Description>
            }
            cancelButton={
              <ConfirmDialog.CancelButton
                onPress={() => {
                  close(false);
                  exit();
                }}
              >
                {t('common:actions.cancel')}
              </ConfirmDialog.CancelButton>
            }
            confirmButton={
              <ConfirmDialog.ConfirmButton
                onPress={() => {
                  close(true);
                  exit();
                }}
              >
                {t('weather:locationPrompt.register')}
              </ConfirmDialog.ConfirmButton>
            }
          />
        ))
        .then((accepted) => {
          introductionService.markIntroductionSeen();
          setHasSeen(true);
          return accepted ? request() : undefined;
        })
        .catch((error) => {
          logger.warn(WEATHER_LOG_EVENT.INTRODUCTION_FAILED, { error: toError(error).message });
        });
    });
    return () => cancelIdleCallback(task);
  }, [introductionService, inviteService, logger, overlay, request, shouldIntroduce, stable, t]);

  return { isPending: location.status === 'checking' || shouldIntroduce };
}
