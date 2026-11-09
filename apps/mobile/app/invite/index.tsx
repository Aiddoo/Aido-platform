import { InviteCodeEntryForm } from '@src/features/social/invite/components/invite-code-entry-form';
import { useTrackInviteLinkOpened } from '@src/features/social/invite/hooks/use-track-invite-link-opened';
import { useTranslation } from '@src/shared/i18n';
import { Box, H3, Spacing, Text } from '@src/shared/ui';

export default function InviteCodeEntryRoute() {
  const { t } = useTranslation('invite');
  useTrackInviteLinkOpened();

  return (
    <Box flex={1} className="bg-white">
      <InviteCodeEntryForm>
        <H3>{t('codeEntry.headline')}</H3>

        <Spacing size={8} />

        <Text size="b3" shade={7}>
          {t('codeEntry.description')}
        </Text>

        <Spacing size={32} />
      </InviteCodeEntryForm>
    </Box>
  );
}
