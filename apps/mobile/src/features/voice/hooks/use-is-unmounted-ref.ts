import { type RefObject, useEffect, useRef } from 'react';

/** 내려간 뒤 끝난 권한·기능 확인이 인식기를 켜면 아무도 끄지 못해 await 뒤에 읽는다. effect가 다시 돌면 다시 붙은 것으로 본다 */
export function useIsUnmountedRef(): RefObject<boolean> {
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  return isUnmountedRef;
}
