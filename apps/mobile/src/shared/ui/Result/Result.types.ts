import type { ReactNode } from 'react';
import type { ButtonProps } from '../Button/Button.types';

export interface ResultProps {
  /** 상단 아이콘 */
  icon?: ReactNode;
  /** 제목 */
  title: string;
  /** 설명 (줄바꿈 지원) */
  description?: string;
  /** 버튼 (Result.Button 사용) */
  button?: ReactNode;
  /** 추가 className */
  className?: string;
}

export interface ResultButtonProps extends Omit<ButtonProps, 'size' | 'display'> {}
