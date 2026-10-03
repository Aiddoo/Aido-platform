import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useEffect, useRef } from 'react';

import { useWeatherSession } from '../providers/weather-session-provider';

export function useWeatherIntroduction() {
  const session = useWeatherSession();
  const stable = useStableFeedForeground();
  const overlay = useOverlay();
  const { t } = useTranslation(['weather', 'common']);
  const claimed = useRef(false);

  useEffect(() => {
    if (!stable || session.status === 'checking' || !session.needsIntroduction || claimed.current)
      return;
    const task = requestIdleCallback(() => {
      if (claimed.current) return;
      claimed.current = true;
      void overlay
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
          if (accepted) void session.syncLocation(true);
        });
    });
    return () => cancelIdleCallback(task);
  }, [overlay, session, stable, t]);
}
