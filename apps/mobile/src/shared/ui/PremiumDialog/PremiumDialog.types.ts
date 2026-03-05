export interface PremiumDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 제목. 기본값: "프리미엄 기능" */
  title?: string;
  /** 프리미엄 필요 사유 설명 */
  description: string;
  /** 구독하기 버튼을 눌렀을 때 호출 */
  onConfirm?: () => void;
}
