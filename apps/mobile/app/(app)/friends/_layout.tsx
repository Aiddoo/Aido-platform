import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon, SearchIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const FriendsLayout = () => {
  const headerBg = useResolveClassNames('bg-white');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();
  const { t } = useTranslation('friend');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        contentStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('screenTitle'),
          headerRight: () => (
            <View className="justify-center items-center">
              <Pressable onPress={() => router.push('/friends/search')} hitSlop={8} className="p-2">
                <SearchIcon width={20} height={20} colorClassName="text-gray-9" />
              </Pressable>
            </View>
          ),
        }}
      />
      <Stack.Screen name="search" options={{ title: t('search.title') }} />
      <Stack.Screen name="add" options={{ title: '' }} />
    </Stack>
  );
};

export default FriendsLayout;
