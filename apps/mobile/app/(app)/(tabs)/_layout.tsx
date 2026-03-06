import ListIconSvg from '@assets/icons/ic_list.svg';
import PersonIconSvg from '@assets/icons/ic_person.svg';
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

  return (
    <NativeTabs tintColor={activeStyle.color} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Label>할 일</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mypage">
        <NativeTabs.Trigger.Label>마이</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidBottomTabs() {
  const activeStyle = useResolveClassNames('text-main');
  const inactiveStyle = useResolveClassNames('text-gray-5');
  const tabBarBg = useResolveClassNames('bg-white');
  const tabBarBorder = useResolveClassNames('border-gray-3');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarInactiveTintColor: inactiveStyle.color as string,
        tabBarStyle: {
          backgroundColor: tabBarBg.backgroundColor as string,
          borderTopWidth: 0.5,
          borderTopColor: tabBarBorder.borderColor as string,
        },
        headerShown: false,
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: '할 일',
          tabBarIcon: ({ color, size }) => <ListIconSvg width={size} height={size} color={color} />,
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />

      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이',
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
