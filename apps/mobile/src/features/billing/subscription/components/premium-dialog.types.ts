export interface PremiumDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 기본값: "프리미엄 기능" */
  title?: string;
  description: string;
  /** 다이얼로그를 닫은 뒤 호출한다. 구독 화면 이동은 부르는 쪽이 정한다 */
  onSubscribe: () => void;
  /** 구독 대신 고를 수 있는 행동(예: 친구 초대로 자리 늘리기). 있으면 구독보다 먼저 보여 준다 */
  alternativeAction?: PremiumDialogAlternativeAction;
}

export interface PremiumDialogAlternativeAction {
  label: string;
  onPress: () => void;
}
