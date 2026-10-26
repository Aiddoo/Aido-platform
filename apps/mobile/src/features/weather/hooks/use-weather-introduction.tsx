import { ErrorCode } from '@aido/api/errors';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors/api-error';
import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useWeatherSession } from '../components/providers/weather-session-provider';
import {
  isForecastRequestable,
  useGetForecastQueryOptions,
} from '../queries/get-forecast-query-options';

/**
 * 서버에 등록한 위치가 없을 때만(예보가 WEATHER_1902) 위치 등록을 한 번 권한다. 다른 기기·이전 설치에서
 * 등록한 위치로 이미 날씨를 보고 있으면 권하지 않는다. 로그인 전에 연 초대처럼 이어서 열 화면이 남아
 * 있으면 그 이동이 끝나고 피드로 돌아올 때까지 미룬다.
 */
export function useWeatherIntroduction() {
  const session = useWeatherSession();
  const stable = useStableFeedForeground();
  const overlay = useOverlay();
  const inviteService = useInviteService();
  const { t } = useTranslation(['weather', 'common']);
  const hasClaimed = useRef(false);
  const { error: forecastError } = useQuery({
    ...useGetForecastQueryOptions(),
    enabled: isForecastRequestable(session),
  });
  const isServerLocationMissing =
    isApiError(forecastError) && forecastError.hasCode(ErrorCode.WEATHER_1902);

  useEffect(() => {
    if (
      !stable ||
      session.status === 'checking' ||
      !session.shouldIntroduce ||
      !isServerLocationMissing ||
      hasClaimed.current
    ) {
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
          session.dismissIntroduction();
          if (accepted) {
            session.syncLocation(true);
          }
        });
    });
    return () => cancelIdleCallback(task);
  }, [inviteService, isServerLocationMissing, overlay, session, stable, t]);
}
