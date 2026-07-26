import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { useEffect, useMemo, useRef } from 'react';
import { ActivationPolicy } from '../../models/activation.model';
import { useActivationProgress } from './use-activation-progress';

export function useAutomaticPushRegistration(): boolean {
  const notificationService = useNotificationService();
  const logger = useLogger();
  const activation = useActivationProgress();
  const attemptedKeyRef = useRef<string | null>(null);
  const preflightAttemptedRef = useRef(false);

  const canRegister =
    activation.hasUserError ||
    (activation.isReady &&
      ActivationPolicy.shouldRegisterPushAutomatically({
        config: activation.config,
        user: activation.user,
        progress: activation.progress,
      }));

  const registrationKey = useMemo(() => {
    if (!canRegister) {
      return null;
    }
    const unlockedAt =
      activation.progress.activatedAt ?? activation.progress.pushRegistrationUnlockedAt;
    return `${activation.user?.id ?? 'compatibility-fallback'}:${
      unlockedAt?.toISOString() ?? 'existing'
    }`;
  }, [activation.progress, activation.user, canRegister]);

  useEffect(() => {
    if (!activation.isAuthenticated) {
      preflightAttemptedRef.current = false;
      return;
    }
    if (preflightAttemptedRef.current) {
      return;
    }

    preflightAttemptedRef.current = true;
    notificationService
      .setupPushNotifications({ requestPermission: false })
      .catch((error) =>
        logger.warn('[Notification] Existing push token preflight skipped', { error }),
      );
  }, [activation.isAuthenticated, logger, notificationService]);

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
