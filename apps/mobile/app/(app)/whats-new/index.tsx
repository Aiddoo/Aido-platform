import { Release1140Steps } from '@src/features/app-config/whats-new/components/release-1-14-0-steps';
import { Release1150Steps } from '@src/features/app-config/whats-new/components/release-1-15-0-steps';
import { RELEASE_ID } from '@src/features/app-config/whats-new/constants/whats-new.constants';
import { useWhatsNewParams } from '@src/features/app-config/whats-new/hooks/use-whats-new-params';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { match } from 'ts-pattern';

export default function WhatsNewRoute() {
  const [{ releaseId }] = useWhatsNewParams();
  const isInviteAvailable = useIsInviteAvailable();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" testID="whats-new-screen">
      <ReadableContent flex={1} px={20} pb={16}>
        {match(releaseId)
          .with(RELEASE_ID.v1_15_0, () => <Release1150Steps />)
          .with(RELEASE_ID.v1_14_0, () => (
            <Release1140Steps isInviteAvailable={isInviteAvailable} />
          ))
          .exhaustive()}
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
