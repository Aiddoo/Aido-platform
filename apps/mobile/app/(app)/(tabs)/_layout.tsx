import FillCheckIconSvg from '@assets/icons/ic_fill_check.svg';
import ListIconSvg from '@assets/icons/ic_list.svg';
import PersonIconSvg from '@assets/icons/ic_person.svg';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useResolveClassNames } from 'uniwind';

function useLiquidGlassAvailable() {
  const [state, setState] = useState<{ ready: boolean; available: boolean }>({
    ready: Platform.OS !== 'ios',
    available: false,
  });

  useEffect(() => {
    const check = async () => {
      if (Platform.OS !== 'ios') return;
      if (!isLiquidGlassAvailable() || !isGlassEffectAPIAvailable()) {
        setState({ ready: true, available: false });
        return;
      }

      try {
        const reduce = await AccessibilityInfo.isReduceTransparencyEnabled();
        setState({ ready: true, available: !reduce });
      } catch {
        setState({ ready: true, available: false });
      }
    };

    check();
  }, []);

  return state;
}

export default function TabsLayout() {
  const { ready, available } = useLiquidGlassAvailable();

  if (!ready) return null;

  if (available) {
    return <IOSLiquidGlassTabs />;
  }

  return <AndroidBottomTabs />;
}

function IOSLiquidGlassTabs() {
  const activeStyle = useResolveClassNames('text-main');

  return (
    <NativeTabs tintColor={activeStyle.color} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="home">
        <Label>홈</Label>
        <Icon sf="checkmark.circle.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="feed">
        <Label>피드</Label>
        <Icon sf="list.bullet" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mypage">
        <Label>마이</Label>
        <Icon sf="person.fill" />
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
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <FillCheckIconSvg width={size} height={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />

      <Tabs.Screen
        name="feed"
        options={{
          title: '피드',
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
