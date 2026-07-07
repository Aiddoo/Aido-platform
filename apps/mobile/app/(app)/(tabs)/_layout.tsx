import ListIconSvg from '@assets/icons/ic_list.svg';
import MemoIconSvg from '@assets/icons/ic_memo.svg';
import PersonIconSvg from '@assets/icons/ic_person.svg';
import { useTranslation } from '@src/shared/i18n';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useResolveClassNames } from 'uniwind';

function useLiquidGlassAvailable() {
  const glassSupported = useMemo(
    () => Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable(),
    [],
  );

  const [available, setAvailable] = useState(glassSupported);

  useEffect(() => {
    if (!glassSupported) return;

    let isMounted = true;

    const check = async () => {
      try {
        const reduce = await AccessibilityInfo.isReduceTransparencyEnabled();
        if (isMounted) {
          setAvailable(!reduce);
        }
      } catch (error) {
        console.warn('[TabsLayout] Failed to check reduce transparency:', error);
      }
    };

    check();

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (reduceEnabled) => {
        setAvailable(!reduceEnabled);
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [glassSupported]);

  return available;
}

export default function TabsLayout() {
  const liquidGlass = useLiquidGlassAvailable();
  return liquidGlass ? <IOSLiquidGlassTabs /> : <AndroidBottomTabs />;
}

function IOSLiquidGlassTabs() {
  const activeStyle = useResolveClassNames('text-main');
  const { t } = useTranslation();

  return (
    <NativeTabs tintColor={activeStyle.color} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Label>{t('tabs.todo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="memo">
        <NativeTabs.Trigger.Label>{t('tabs.memo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="note.text" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mypage">
        <NativeTabs.Trigger.Label>{t('tabs.mypage')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidBottomTabs() {
  const activeStyle = useResolveClassNames('text-main');
  const { t } = useTranslation();
  const inactiveStyle = useResolveClassNames('text-gray-5');
  const tabBarBg = useResolveClassNames('bg-white');
  const tabBarBorder = useResolveClassNames('border-gray-3');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarInactiveTintColor: inactiveStyle.color as string,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: tabBarBg.backgroundColor as string,
          borderTopWidth: 0.5,
          borderTopColor: tabBarBorder.borderColor as string,
        },
        sceneStyle: { backgroundColor: tabBarBg.backgroundColor as string },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: t('tabs.todo'),
          tabBarIcon: ({ color, size }) => <ListIconSvg width={size} height={size} color={color} />,
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />

      <Tabs.Screen
        name="memo"
        options={{
          title: t('tabs.memo'),
          tabBarIcon: ({ color, size }) => <MemoIconSvg width={size} height={size} color={color} />,
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />

      <Tabs.Screen
        name="mypage"
        options={{
          title: t('tabs.mypage'),
          tabBarIcon: ({ color, size }) => (
            <PersonIconSvg width={size} height={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />
    </Tabs>
  );
}
