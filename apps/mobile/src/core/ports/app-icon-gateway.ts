export interface AppIconGateway {
  isAvailable(): boolean;
  getCurrentIcon(): Promise<string | null>;
  changeIcon(name: string | null): Promise<string | null>;
}
