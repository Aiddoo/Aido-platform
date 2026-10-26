import memoSelected from '@assets/tab-icons/memo-selected.png';
import memo from '@assets/tab-icons/memo.png';
import mypageSelected from '@assets/tab-icons/mypage-selected.png';
import mypage from '@assets/tab-icons/mypage.png';
import todoSelected from '@assets/tab-icons/todo-selected.png';
import todo from '@assets/tab-icons/todo.png';
import type { SrcIcon } from 'expo-router/native-tabs';

type NativeTabStateIconSource = Extract<NonNullable<SrcIcon['src']>, { selected: unknown }>;

export const NATIVE_TAB_ICON_SOURCES = {
  todo: { default: todo, selected: todoSelected },
  memo: { default: memo, selected: memoSelected },
  mypage: { default: mypage, selected: mypageSelected },
} as const satisfies Record<'todo' | 'memo' | 'mypage', NativeTabStateIconSource>;
