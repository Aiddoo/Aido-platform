import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { useEffect, useMemo, useRef } from 'react';
import { ActivationPolicy } from '../../models/activation.model';
import { useActivationProgress } from './use-activation-progress';

export function useAutomaticPushRegistration(): boolean {
  const notificationService = useNotificationService();
  const logger = useLogger();
  const activation = useActivationProgress();
  const attemptedKeyRef = useRef<string | null>(null);

  const canRegister =
    activation.isReady &&
    ActivationPolicy.shouldRegisterPushAutomatically({
      config: activation.config,
      user: activation.user,
      progress: activation.progress,
    });

  const registrationKey = useMemo(() => {
    if (!canRegister || !activation.user) {
      return null;
    }
    const unlockedAt =
      activation.progress.activatedAt ?? activation.progress.pushRegistrationUnlockedAt;
    return `${activation.user.id}:${unlockedAt?.toISOString() ?? 'existing'}`;
  }, [activation.progress, activation.user, canRegister]);

  useEffect(() => {
    if (!registrationKey) {
      attemptedKeyRef.current = null;
      return;
    }
    if (attemptedKeyRef.current === registrationKey) {
      return;
    }

    attemptedKeyRef.current = registrationKey;
    notificationService.setupPushNotifications().catch((error) => {
      logger.warn('[Notification] Push token registration skipped', { error });
    });
  }, [logger, notificationService, registrationKey]);

  return canRegister;
}
