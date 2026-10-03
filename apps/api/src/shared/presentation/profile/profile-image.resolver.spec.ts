import { describe, expect, it } from "vitest";

import { resolveProfileImage } from "./profile-image.resolver.js";

describe("프로필 아이콘 버전 호환", () => {
	it.each([undefined, "", "invalid", "1.10.0", "1.9.9"])(
		"버전이 %s이면 기존 아이콘으로 표시한다",
		(version) => {
			// Given
			const images = ["russian_blue", "cream_cat", "tuxedo_cat"];
			// When
			const result = images.map((image) => resolveProfileImage(image, version));
			// Then
			expect(result).toEqual(["scottish_fold", "white_cat", "black_cat"]);
		},
	);

	it.each(["1.10.1", "1.10.2", "1.11.0", "2.0.0"])(
		"버전이 %s이면 새 아이콘을 그대로 표시한다",
		(version) => {
			// Given
			const image = "russian_blue";
			// When
			const result = resolveProfileImage(image, version);
			// Then
			expect(result).toBe(image);
		},
	);

	it.each([null, "default", "siamese", "https://example.com/avatar.png"])(
		"기존 프로필 값 %s은 변경하지 않는다",
		(image) => {
			// Given
			const original = image;
			// When
			const result = resolveProfileImage(original);
			// Then
			expect(result).toBe(original);
		},
	);
});
