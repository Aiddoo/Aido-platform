import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port";
import { NotificationRecipientLocaleReader } from "./notification-recipient-locale.reader";

describe("NotificationRecipientLocaleReader", () => {
	it("수신자 로케일 포트의 캐시·fallback 동작을 그대로 노출한다", async () => {
		const port: NotificationRecipientLocaleReaderPort = {
			getLocale: jest.fn().mockResolvedValue("en"),
		};
		const reader = new NotificationRecipientLocaleReader(port);

		await expect(reader.getRecipientLocale("user-1")).resolves.toBe("en");
		expect(port.getLocale).toHaveBeenCalledWith("user-1");
	});
});
