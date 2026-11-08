export interface PremiumDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 제목. 기본값: "프리미엄 기능" */
  title?: string;
  /** 프리미엄 필요 사유 설명 */
  description: string;
  /** 구독하기를 눌렀을 때 다이얼로그를 닫은 뒤 호출. 구독 화면 이동은 부르는 쪽이 정한다 */
  onSubscribe: () => void;
  /** 구독 대신 고를 수 있는 행동(예: 친구 초대로 자리 늘리기). 있으면 구독보다 먼저 보여 준다 */
  alternativeAction?: PremiumDialogAlternativeAction;
}

export interface PremiumDialogAlternativeAction {
  label: string;
  onPress: () => void;
}
