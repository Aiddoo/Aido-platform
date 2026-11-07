import { InquiryForm } from '@src/features/support/inquiry/components/inquiry-form';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';

export default function InquiryScreen() {
  const { t } = useTranslation('inquiry');

  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <InquiryForm title={t('form.selectCategory')} />
      </ReadableContent>
    </Box>
  );
}
