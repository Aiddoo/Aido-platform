import { isVersionAtLeast } from "#api/shared/domain/version/compare-version";

export const resolveProfileImage = (
	profileImage: string | null,
	appVersion?: string,
): string | null => {
	if (isVersionAtLeast(appVersion ?? null, "1.10.1")) return profileImage;
	switch (profileImage) {
		case "russian_blue":
			return "scottish_fold";
		case "cream_cat":
			return "white_cat";
		case "tuxedo_cat":
			return "black_cat";
		default:
			return profileImage;
	}
};
