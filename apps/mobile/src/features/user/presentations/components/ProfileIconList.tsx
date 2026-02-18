import { APP_ICONS } from '@src/features/app-icon/constants/app-icons.constant';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { updateProfileMutationOptions } from '@src/features/user/presentations/queries/update-profile-mutation-options';
import { Avatar } from '@src/shared/ui/Avatar/Avatar';
import { Grid } from '@src/shared/ui/Grid/Grid';
import { GridItem } from '@src/shared/ui/Grid/GridItem';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback } from 'heroui-native';

export function ProfileIconList() {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const updateProfileMutation = useMutation(updateProfileMutationOptions());

  return (
    <Grid columns={3}>
      {APP_ICONS.map((icon) => {
        const selected = icon.key === (user.profileImage ?? 'default');
        return (
          <GridItem key={icon.key} p={8} className="items-center">
            <PressableFeedback
              isDisabled={updateProfileMutation.isPending}
              onPress={() => {
                if (icon.key !== user.profileImage) {
                  updateProfileMutation.mutate({ profileImage: icon.key });
                }
              }}
              className="rounded-2xl overflow-visible"
            >
              <VStack align="center" gap={8} py={8} className="overflow-visible">
                <Avatar isSelected={selected} alt={icon.label} className="w-20 h-20 rounded-2xl">
                  <Avatar.Image source={icon.preview} />
                </Avatar>
                <Text
                  size="b4"
                  weight={selected ? 'semibold' : 'normal'}
                  shade={selected ? 9 : 6}
                  numberOfLines={1}
                >
                  {icon.label}
                </Text>
              </VStack>
              <PressableFeedback.Highlight className="rounded-2xl" />
            </PressableFeedback>
          </GridItem>
        );
      })}
    </Grid>
  );
}

ProfileIconList.Loading = function Loading() {
  return (
    <Grid columns={3}>
      {times(6, (i) => (
        <GridItem key={i} p={8} className="items-center">
          <Avatar.Loading />
        </GridItem>
      ))}
    </Grid>
  );
};
