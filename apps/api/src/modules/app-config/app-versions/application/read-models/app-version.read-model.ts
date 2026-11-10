export type AppVersionConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly ios: { readonly latestVersion: string };
      readonly android: { readonly latestVersion: string };
    };
