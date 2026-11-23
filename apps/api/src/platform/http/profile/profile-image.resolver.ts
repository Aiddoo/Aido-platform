import { isSemanticVersionAtLeast } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

export const resolveProfileImage = (
  profileImage: string | null,
  appVersion?: string,
): string | null => {
  if (isSemanticVersionAtLeast(appVersion, "1.10.1")) {
    return profileImage;
  }
  return match(profileImage)
    .with("russian_blue", () => "scottish_fold")
    .with("cream_cat", () => "white_cat")
    .with("tuxedo_cat", () => "black_cat")
    .otherwise(() => profileImage);
};
