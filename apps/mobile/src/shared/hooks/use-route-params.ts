import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import { z } from 'zod';

/** z.encode는 undefined 키를 빼지만 setParams는 얕은 병합이라, 빠진 키는 URL에서 지워지지 않는다 */
function encodeRouteParams<TSchema extends z.ZodObject>(
  schema: TSchema,
  next: Partial<z.output<TSchema>>,
) {
  const encoded = new Map(Object.entries(z.encode(schema.partial(), next)));

  return Object.fromEntries(
    Object.keys(next).map((key) => {
      const value = encoded.get(key);
      return [key, typeof value === 'string' ? value : undefined] as const;
    }),
  );
}

/**
 * 쓰는 필드의 URL 형식은 문자열이고 `.transform` 대신 `z.codec`이어야 한다.
 * 쓰기는 이 훅을 부른 화면의 params다. 비동기 뒤에 불러도 그 사이 focus된 다른 화면에 쓰지 않는다
 */
export function useRouteParams<TSchema extends z.ZodObject>(schema: TSchema) {
  const params = schema.parse(useLocalSearchParams());
  // 기본 타입은 route 목록이 없어 setParams가 값을 받지 않는다. 화면 navigation의 기본 모양으로 받는다
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const setParams = (next: Partial<z.output<TSchema>>) =>
    navigation.setParams(encodeRouteParams(schema, next));

  return [params, setParams] as const;
}
