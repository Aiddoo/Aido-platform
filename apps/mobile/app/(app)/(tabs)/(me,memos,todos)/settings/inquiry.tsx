import { InquiryForm } from '@src/features/support/inquiry/components/inquiry-form';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function InquiryScreen() {
  const { t } = useTranslation(['inquiry', 'settings']);

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.inquiry') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <InquiryForm title={t('form.selectCategory')} />
        </ReadableContent>
      </Box>
    </>
  );
}
