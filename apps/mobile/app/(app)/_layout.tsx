import { CheckIcon, MenuIcon, PersonIcon } from '@src/shared/ui/Icon';
import { Tabs } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function AppLayout() {
  const activeStyle = useResolveClassNames('text-main');
  const inactiveStyle = useResolveClassNames('text-gray-5');
  const borderStyle = useResolveClassNames('border-gray-2');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarInactiveTintColor: inactiveStyle.color as string,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: borderStyle.borderColor as string,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <CheckIcon width={24} height={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: '피드',
          tabBarIcon: ({ color }) => <MenuIcon width={24} height={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이',
          tabBarIcon: ({ color }) => <PersonIcon width={24} height={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
