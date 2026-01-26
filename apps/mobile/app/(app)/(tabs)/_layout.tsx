import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { match } from 'ts-pattern';

import { useResolveClassNames } from 'uniwind';

export default function TabsLayout() {
  return match(Platform.OS)
    .with('ios', () => <IOSLiquidGlassTabs />)
    .otherwise(() => <AndroidBottomTabs />);
}

function IOSLiquidGlassTabs() {
  const activeStyle = useResolveClassNames('text-main');

  return (
    <NativeTabs tintColor={activeStyle.color}>
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="feed"
        options={{
          title: '피드',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
