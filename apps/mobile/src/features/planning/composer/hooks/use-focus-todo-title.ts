import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { useEffect, useRef } from 'react';
import type { UseFormSetFocus } from 'react-hook-form';

/** 고르기 시트가 닫히는 애니메이션과 겹치면 키보드가 올라오다 멈춰 다음 프레임에 제목 칸에 포커스한다 */
export function useFocusTodoTitle(setFocus: UseFormSetFocus<TodoFormValues>) {
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return () => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setFocus('title');
    });
  };
}
