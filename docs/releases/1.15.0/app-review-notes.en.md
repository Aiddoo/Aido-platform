# Aido 1.15.0 review notes (draft)

**Status: draft, not submitted.** Menu paths and on-screen text match code `42c2c30a2`. The Korean version is [app-review-notes.ko.md](app-review-notes.ko.md), and data declarations follow [privacy-label.md](privacy-label.md). The simulator and emulator lines come from library docs and code. We did not run them on a simulator or emulator.

Before pasting:

- The App Store Notes field allows 4,000 characters. The text below is 3,900 characters with the demo account left blank, so the email and password can use up to 100 characters together. Count again after filling them in.
- The demo account must be on the free plan (no subscription or invite reward), have only the 2 default categories, and be more than 1 day old. A newer account sees the notifications screen right after sign-in instead of the system alert described in the notes.
- The 1-month free trial is an introductory offer on the yearly subscription in App Store Connect and a free-trial offer on the yearly base plan in Play Console. If it isn't set there, the app shows only the regular prices, and the trial lines in the notes don't apply.
- `{price}` and `{date}` stand for the store price and the trial end date that the app fills in.

## App Store Connect: App Review Information > Notes

```text
Aido 1.15.0 adds Speak to add, Voice notes, AI to-dos from text, repeating to-dos, a Premium limit sheet, and a 1-month free trial on the yearly plan.

Demo account (free plan)
- Email:
- Password:

How to test
1. To-dos tab: tap the mic in the add to-do sheet, choose Agree, allow the mic, and say "Workout every Monday and Friday". Save the to-dos you want.
2. Memos tab: tap "Make a voice note", speak, stop, then summarize.
3. Me tab > App icon: tap a cat icon. The Premium sheet opens ("See Premium" / "Not now").
4. Me tab > Manage categories: add a third category, then tap add again. The sheet appears before any typing.
5. Tap "See Premium" for the paywall. The trial shows only for a sandbox Apple Account that never subscribed to Aido.
Please test voice on a real device.

Subscriptions and free trial (Guideline 3.1.2)
- Monthly or yearly auto-renewing plans; yearly is preselected. The largest price is the billed amount.
- New yearly subscribers get a 1-month free trial, shown only if the App Store says the account is eligible.
- The plan then shows "1 month free" and a dated timeline: trial starts today → reminder 3 days before the end → "{price}/year charged". The button reads "Start free for 1 month", with "Billed {price}/year from {date} · Cancel anytime" right below.
- The renewal notice, Terms and Privacy links, and Restore purchases are on the same screen.
- During the trial, Me tab > Manage subscription shows "Free trial" with the end and first payment dates. The server sends a reminder push and inbox notice 3 days before it ends.

Limits and the Premium sheet
- Plans never limit adding or completing to-dos. Free: 10 AI to-dos and 3 voice notes a month, 5 friends (+1 per qualified invite), 3 categories, 3 nudges and 3 cheers a day. Premium: up to 1,000 AI to-dos (fair use) and 100 voice notes a month, 30 categories, unlimited friends, nudges, and cheers.
- The sheet shows usage ("10 of 10 used"), the reset date, and Free → Premium numbers. After "Not now", that feature shows a toast with "See Premium" for the day. At the friend limit, the main button is "Invite a friend to add 1 more".

Third-party AI consent (Guideline 5.1.2(i))
- Before any AI request, a sheet shows what is sent (what you type or say, to-dos, date and time zone; never name, email, friends, or audio), who processes it (Anthropic, Google, OpenAI for text; Apple or Google speech recognition for voice), and that it's for AI features only, never ads. Not now sends nothing, and the server rejects AI requests without consent. Withdraw: Me tab > Terms & policies > AI data sharing.

Permissions and notifications
- Mic: only after tapping a mic or "Make a voice note". No background audio. Audio files aren't sent to our servers. Only text is, and we don't store transcripts.
- Notifications: asked right after sign-up, after tapping "Continue" on a notifications screen. The demo account gets it on first setting a to-do time. If denied, the app works and a timed to-do shows "Notifications are off, so we can't remind you · Open settings".
- Location: While Using only, after tapping the weather badge and "Continue".
- Promotional push is opt-in only, titled "(Ad)" ("(광고)" in Korean) with opt-out steps and a "Turn off promotional notifications" action. Changes show the server's date; opted-in users are reminded every 2 years.

Invite rewards (since 1.13.0)
Free Premium time inside Aido only: no cash value, not transferable, no purchase required, nothing for ratings, reviews, or other app downloads, and inviting is never required. Reward Premium involves no payment, does not auto-renew, and starts after an active subscription ends. Terms, Article 13-2: https://aido.kr/en/terms

Where to find other items
- Account deletion: Me tab > Delete account. Web: https://aido.kr/en/account-deletion
- Report and block (1.2): ••• menu and Me tab > Manage friends. Contact: matthew@redband.co.kr
```

## Google Play: App content > App access and release notes for review

```text
Demo account (free plan)
- Email:
- Password:

Sensitive permissions
- RECORD_AUDIO: only after someone taps the mic in the add to-do sheet, "Make a voice note" on the Memos tab, or the voice typing button in the subtask sheet. Denying it leaves typing and every other feature working. Speak to add and Voice notes stop listening when the app goes to the background or another screen opens. No foreground service records audio.
- ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION: foreground only, for the weather screen and weather notifications. The app asks only after someone taps the weather badge and "Continue". There is no background location permission. The app requests balanced accuracy.
- POST_NOTIFICATIONS: reminders and friend activity. Right after sign-up, the system dialog appears after tapping "Continue" on a notifications screen. Older accounts see the dialog when they first set a to-do time. Denying keeps the app fully usable.

Removed in 1.15.0 because Aido does not use them: USE_BIOMETRIC, USE_FINGERPRINT, SYSTEM_ALERT_WINDOW, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE.

Where voice and text go
- Speech recognition uses Android's speech service. It runs on the device when the language model is available for Speak to add and Voice notes. Otherwise, and for subtask voice typing, Google speech recognition may process the voice over the network.
- Voice notes saves audio on the device on Android 13 and above. Audio files aren't sent to Aido's servers. They are removed after 30 days, and can be deleted in Me tab > Recording storage. They may be part of device backups.
- After speech becomes text, the text goes to Aido's server and to AI providers (Anthropic Claude, Google Gemini, OpenAI) to organize it into to-dos or a summary. Our server does not store the transcript.

Consent
- Before AI features first send anything, a sheet shows what is sent, who processes it, and how it's used. It requires tapping Agree. Not now or tapping outside sends nothing.
- Withdraw anytime: Me tab > Terms & policies > AI data sharing.
- Promotional push is opt-in only. Titles start with "(Ad)" ("(광고)" in Korean) with opt-out steps, and the push has a "Turn off promotional notifications" action.

AI output
- AI turns the person's own words into suggested to-dos and summaries, and nothing is saved until they confirm it. They can report a problem from Me tab > Contact us.

Subscriptions, free trial, and limits
- Monthly or yearly auto-renewing plans; yearly is preselected. New yearly subscribers get a 1-month free trial, set as a free-trial offer in Play Console and shown only when Google Play offers it to the account. The paywall then shows "Start free for 1 month" with "Billed {price}/year from {date} · Cancel anytime" below it, and a timeline with the reminder 3 days before billing.
- Free: 10 AI to-dos and 3 voice notes a month, 5 friends, 3 categories, 3 nudges and 3 cheers a day. Plans never limit adding or completing to-dos. At a limit or a Premium-only feature, a sheet shows usage, the reset date, and Free → Premium numbers, with "See Premium" and "Not now".

How to test
1. Sign in with the demo account.
2. To-dos tab: open the add to-do sheet and tap the mic. Choose Agree, allow the microphone, then speak. Review the suggested to-dos and save the ones you want.
3. Memos tab: tap "Make a voice note", speak, stop, then summarize.
4. Me tab > App icon: tap a cat icon to see the Premium sheet. "See Premium" opens the paywall. Use a license tester account that never subscribed to see the trial.

Test environment
- Voice features need a speech service, such as the Google app, and a working microphone. An emulator without them can't listen.
- Android 12 and below don't support continuous recognition or saved recordings, so listening can stop at a pause and there is no playback.
```
