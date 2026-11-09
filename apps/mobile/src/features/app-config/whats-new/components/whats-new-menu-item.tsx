import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, SettingsListGroup, WhatsNewDuoIcon } from '@src/shared/ui';
import { router } from 'expo-router';

import { useHasUnseenRelease } from '../hooks/use-has-unseen-release';

export function WhatsNewMenuItem() {
  const { t } = useTranslation('whatsNew');
  const push = useSingleTap(router.push);
  const hasUnseenRelease = useHasUnseenRelease();
  const label = t('entry.mypage');

  return (
    <SettingsListGroup.Item
      testID="whats-new-open"
      icon={<SettingsListGroup.Icon Icon={WhatsNewDuoIcon} />}
      label={label}
      accessibilityLabel={hasUnseenRelease ? `${label}, ${t('list.unseenLabel')}` : label}
      value={
        hasUnseenRelease ? (
          <Box testID="whats-new-unseen-dot" className="size-2 rounded-full bg-main" />
        ) : undefined
      }
      onPress={() => push('/whats-new/releases')}
    />
  );
}
