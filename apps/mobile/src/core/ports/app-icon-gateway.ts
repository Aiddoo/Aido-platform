export interface AppIconGateway {
  isSupported(): boolean;
  getCurrentIcon(): Promise<string | null>;
  changeIcon(name: string | null): Promise<string | null>;
}
