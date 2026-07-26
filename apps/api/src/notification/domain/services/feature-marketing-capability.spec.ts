import { supportsFeatureDiscoveryMarketing } from "./feature-marketing-capability";

describe("supportsFeatureDiscoveryMarketing", () => {
	it.each([
		[{ payloadVersion: 2, appVersion: "1.8.0" }, true],
		[{ payloadVersion: 2, appVersion: "1.9.0" }, true],
		[{ payloadVersion: 3, appVersion: "2.0.0" }, false],
		[{ payloadVersion: 1, appVersion: "1.9.0" }, false],
		[{ payloadVersion: 2, appVersion: "1.7.9" }, false],
		[{ payloadVersion: 2, appVersion: null }, false],
		[{ payloadVersion: 2, appVersion: "unknown" }, false],
	])("payload/app capability %o => %s", (capability, supported) => {
		expect(supportsFeatureDiscoveryMarketing(capability)).toBe(supported);
	});
});
