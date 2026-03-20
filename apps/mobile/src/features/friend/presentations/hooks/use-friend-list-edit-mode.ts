import { type NavigationProp, type RouteProp, useRoute } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useCallback } from 'react';

type RouteParams = {
  isEditing?: boolean;
};

type FriendsRouteParams = {
  friends: RouteParams;
};

/**
 * 친구 목록 편집 모드 상태를 관리하는 훅.
 *
 * 편집 모드가 활성화되면 드래그 핸들과 삭제 버튼이 노출된다.
 * route params 기반으로 동작하여, 스크린(헤더 버튼)과 FriendList(목록 렌더링)가
 * props 없이 동일한 상태를 구독할 수 있다.
 *
 * @returns `[isEditMode, setIsEditMode]` — useState와 동일한 튜플 형태
 */
export const useFriendListEditMode = () => {
  const route = useRoute<RouteProp<FriendsRouteParams, 'friends'>>();
  const navigation = useNavigation<NavigationProp<FriendsRouteParams>>();

  const isEditMode = route.params?.isEditing ?? false;

  const setIsEditMode = useCallback(
    (value: boolean) => {
      navigation.setParams({ isEditing: value });
    },
    [navigation],
  );

  return [isEditMode, setIsEditMode] as const;
};
