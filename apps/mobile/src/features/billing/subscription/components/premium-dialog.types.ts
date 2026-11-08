export interface PremiumDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  onSubscribe: () => void;
  alternativeAction?: PremiumDialogAlternativeAction;
}

export interface PremiumDialogAlternativeAction {
  label: string;
  onPress: () => void;
}
