import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 섹션 이름(`label`) 같은 바깥 구성은 화면이 원본 SettingsListGroup props로 넘긴다 */
export function TimeFormatSetting(props: SettingsSectionProps) {
  const { t } = useTranslation('notification');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Toggle
        label={t('settings.timeFormat24')}
        isSelected={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
        onSelectedChange={(isEnabled) =>
          updateMutation.mutate({
            timeFormat: isEnabled ? 'TWENTY_FOUR_HOUR' : 'TWELVE_HOUR',
          })
        }
        isDisabled={updateMutation.isPending}
      />
    </SettingsListGroup>
  );
}
