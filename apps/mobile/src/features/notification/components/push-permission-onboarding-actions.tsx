import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { useAndroidBackHandler } from '@src/shared/hooks/use-android-back-handler';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Button, STACK_CLOSE_ICON } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useCallback } from 'react';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { usePushPermissionAction } from '../hooks/use-push-permission-action';
import { pushPermissionDeferredAtStoredValue } from '../schemas/push-permission-deferred-at-storage.schema';

const SOURCE: PushPermissionPromptSource = 'onboarding';

/** 시스템 알림 창 앞 화면이라 본문 버튼은 [계속] 하나다(App Store 5.1.1). 나가는 길은 헤더 닫기이고, 권한이 정해지거나 닫기가 남으면 화면이 스스로 닫힌다 */
export function PushPermissionOnboardingActions() {
  const { t } = useTranslation(['notification', 'common']);
  const { trackEvent } = useTrack();
  const accountId = useMyAccountId();
  const [_deferredAt, setDeferredAt] = useStoredValue(
    pushPermissionDeferredAtStoredValue,
    accountId,
  );
  const { runStep, isPending } = usePushPermissionAction({ source: SOURCE });

  useTrackView('push_permission_prompt_shown', {
    key: PUSH_PERMISSION_STEP.ASK,
    params: { source: SOURCE, step: PUSH_PERMISSION_STEP.ASK },
  });

  const handleClose = useCallback(() => {
    trackEvent('push_permission_prompt_dismissed', {
      source: SOURCE,
      step: PUSH_PERMISSION_STEP.ASK,
    });
    setDeferredAt(getNowInstant());
  }, [setDeferredAt, trackEvent]);

  // Android 뒤로 가기도 닫기로 받는다. 답 없이 피드로 돌아가면 피드가 이 화면을 다시 연다
  useAndroidBackHandler({
    onBack: () => {
      handleClose();
      return true;
    },
  });

  const handleContinue = () => {
    runStep(PUSH_PERMISSION_STEP.ASK, {
      // 권한 창을 띄우지 못하면 권한이 그대로라 화면이 닫히지 않는다. 앱은 알림 없이도 쓸 수 있게 넘긴다
      onError: () => setDeferredAt(getNowInstant()),
    });
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={STACK_CLOSE_ICON}
          accessibilityLabel={t('common:actions.close')}
          disabled={isPending}
          onPress={handleClose}
        />
      </Stack.Toolbar>
      <Button size="large" isLoading={isPending} onPress={handleContinue}>
        {t('notification:permission.continue')}
      </Button>
    </>
  );
}
