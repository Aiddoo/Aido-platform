import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { ArrowLeftIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { Stack, router } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const AuthLayout = () => {
  const goBack = useSingleTap(router.back);

  const { backgroundColor } = useResolveClassNames('bg-white');
  const headerBg = useResolveClassNames('bg-background');
  const titleColor = useResolveClassNames('text-gray-9');
  const { fontScale } = useFontScale();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom',
        animationDuration: 200,
        contentStyle: { backgroundColor: backgroundColor as string },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitleStyle: {
          fontSize: getScaledFontSize(fontScale),
          fontWeight: '600',
          color: titleColor.color as string,
        },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => goBack()} hitSlop={8} className="p-2">
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="email-login" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="sign-up" options={{ headerShown: true }} />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
};

export default AuthLayout;
