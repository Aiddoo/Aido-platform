export interface BroadcastAction {
  readonly type: "DEEP_LINK" | "BROWSER" | "WEBVIEW" | "NONE";
  readonly url?: string;
}

export type AdminBroadcastType = "ADMIN_BROADCAST" | "ADMIN_TARGETED";

export interface AdminBroadcastMessage {
  readonly userId: string;
  readonly type: AdminBroadcastType;
  readonly title: string;
  readonly body: string;
  readonly action?: BroadcastAction;
  readonly metadata?: { readonly externalUrl: string };
  readonly force: boolean;
}
