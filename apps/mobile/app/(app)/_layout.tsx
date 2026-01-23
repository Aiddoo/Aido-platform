import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useResolveClassNames } from 'uniwind';

const AppLayout = () => {
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
};

export default AppLayout;
