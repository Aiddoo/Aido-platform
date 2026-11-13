import { ReleaseRow } from '@src/features/app-config/whats-new/components/release-row';
import { RELEASE_1_15_0 } from '@src/features/app-config/whats-new/constants/releases.constants';
import { PATCH_NOTES_URL } from '@src/features/app-config/whats-new/constants/whats-new.constants';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  ReadableContent,
  SettingsListGroup,
  Spacing,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

export default function WhatsNewReleasesRoute() {
  const { t } = useTranslation('whatsNew');

  return (
    <>
      <Stack.Screen options={{ title: t('list.title') }} />

      <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <ReadableContent px={16} pt={8} pb={24}>
            {/* 지금 쓸 수 있는 기능을 출시마다 한 줄씩 쌓는다. 최신이 위다 */}
            <VStack gap={10}>
              <ReleaseRow release={RELEASE_1_15_0} />
            </VStack>

            <Spacing size={16} />

            {/* 고친 점까지 담은 전체 내역은 앱에 묶지 않고 패치 노트에서 본다 */}
            <PatchNotesLink />
          </ReadableContent>
        </ScrollView>
      </StyledSafeAreaView>
    </>
  );
}

function PatchNotesLink() {
  const { t } = useTranslation('whatsNew');
  const { resolvedLanguage } = useLanguage();
  const openUrl = useOpenInAppBrowser();

  return (
    <SettingsListGroup>
      <SettingsListGroup.Item
        label={t('list.patchNotes')}
        description={t('list.patchNotesDescription')}
        onPress={() => openUrl(PATCH_NOTES_URL[resolvedLanguage])}
        testID="whats-new-patch-notes"
      />
    </SettingsListGroup>
  );
}
