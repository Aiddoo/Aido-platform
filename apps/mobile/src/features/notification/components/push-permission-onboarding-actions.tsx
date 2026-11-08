import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { usePushPermissionPrompt } from '../hooks/use-push-permission-prompt';
import { useRequestPushPermissionMutationOptions } from '../queries/notification.mutations';

const SOURCE: PushPermissionPromptSource = 'onboarding';

/** 답하면 화면이 스스로 닫힌다. 권한이 정해지거나 [나중에]가 남으면 알림 화면을 지키던 조건이 풀린다 */
export function PushPermissionOnboardingActions() {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const { data: me } = useQuery(useGetMeQueryOptions());
  const [_prompt, { defer }] = usePushPermissionPrompt(me?.id);
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());

  useEffect(() => {
    trackEvent('push_permission_prompt_shown', { source: SOURCE, step: PUSH_PERMISSION_STEP.ASK });
  }, [trackEvent]);

  const handleLater = useCallback(() => {
    trackEvent('push_permission_prompt_dismissed', {
      source: SOURCE,
      step: PUSH_PERMISSION_STEP.ASK,
    });
    defer();
  }, [defer, trackEvent]);

  // Android 뒤로 가기도 [나중에]로 받는다. 답 없이 피드로 돌아가면 피드가 이 화면을 다시 연다
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleLater();
        return true;
      });
      return () => subscription.remove();
    }, [handleLater]),
  );

  const handleAllow = () => {
    requestPermission.mutate(undefined, {
      onSuccess: (permission) =>
        trackEvent('push_permission_requested', { source: SOURCE, status: permission.status }),
      // 권한 창을 띄우지 못하면 권한이 그대로라 화면이 닫히지 않는다. 앱은 알림 없이도 쓸 수 있게 넘긴다
      onError: defer,
    });
  };

  return (
    <HStack gap={8}>
      <Box flex={1}>
        <Button
          variant="weak"
          color="dark"
          size="large"
          isDisabled={requestPermission.isPending}
          onPress={handleLater}
        >
          {t('permission.onboarding.later')}
        </Button>
      </Box>
      <Box flex={1}>
        <Button size="large" isLoading={requestPermission.isPending} onPress={handleAllow}>
          {t('permission.onboarding.allow')}
        </Button>
      </Box>
    </HStack>
  );
}
