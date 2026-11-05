# Aido 1.15.0 review notes (draft)

**Status: draft, not submitted.** Fill in the demo account before pasting. Menu paths match code `da9b73498`. The Korean version is [app-review-notes.ko.md](app-review-notes.ko.md), and data declarations follow [privacy-label.md](privacy-label.md). The simulator and emulator lines come from library docs and code. We did not run them on a simulator or emulator.

## App Store Connect: App Review Information > Notes

```text
Aido 1.15.0 adds voice input ("Speak to add" and "Voice notes"), AI-organized to-dos from text, and repeating to-dos. Weather and friend invites are unchanged since 1.14.0.

Demo account
- Email:
- Password:

When the microphone and speech recognition are used
- Only after someone taps a control: the mic in the add to-do sheet (Speak to add), "Make a voice note" on the Memos tab (Voice notes), or the voice typing button in the subtask sheet.
- The system permission alert appears at that moment. There is no custom screen before it. Speak to add and Voice notes first show the AI data sharing sheet described below, which is a separate consent.
- While listening, the screen shows an animated indicator or a recording timer and waveform, and text appears as it is recognized.
- Speak to add and Voice notes stop listening when the app goes to the background or another screen opens, such as from a notification. The app declares no background audio mode.
- If someone denies access, voice features stop and the app explains how to allow it in Settings. Typing to-dos and every other feature keep working.

Where voice and text go
- Speech recognition: On iOS, Speak to add uses Apple speech recognition. Voice notes use on-device recognition when the device supports it for the chosen language. Otherwise, and for subtask voice typing, Apple speech recognition may process the voice over the network.
- Audio files: Voice notes saves audio on the device for playback. Audio files aren't sent to Aido's servers. They are removed after 30 days, and can be deleted in Me tab > Recording storage. They may be part of device backups.
- Text: after speech becomes text, the text goes to Aido's server and to AI providers (Anthropic Claude, Google Gemini, OpenAI) to organize it into to-dos or a summary. Our server does not store the transcript.
- Recognition hints: a fixed list of common words goes with network recognition. A person's category and to-do names go only with on-device recognition.

Consent for third-party AI (Guideline 5.1.2(i))
- Before AI features first send anything, a sheet lists what is sent, who receives it, how it is used, and how long it is kept, with a Privacy Policy link. The choices are Agree and Not now.
- Not now sends nothing, and the action stops there. Other features keep working. The server also rejects AI requests without consent.
- Withdraw anytime: Me tab > Terms & policies > AI data sharing.
- People who agreed to the previous notice see the updated notice once. If they skip it, their previous consent still applies and only Google is used.

AI uses and limits
- Places that use AI show an AI icon. Free accounts also see how many uses are left. Me tab shows this month's totals.
- There is no prompt on each use. When the monthly uses run out, a Premium dialog appears.
- Free accounts get 10 AI to-do uses and 3 voice notes a month.

How to test
1. Sign in with the demo account.
2. To-dos tab: open the add to-do sheet and tap the mic. Choose Agree on the AI sheet, allow the microphone (and speech recognition if asked), then say "Workout every Monday, Wednesday, and Friday". Review the suggested to-dos and save the ones you want.
3. Memos tab: tap "Make a voice note", speak for a few seconds, stop, then summarize. Play the recording from the result screen.
4. Me tab > Terms & policies: withdraw AI data sharing, then try step 2 again to see the consent sheet return.
5. Me tab > Recording storage: delete the recording.

Please test voice features on a real device. A simulator may have no microphone input or on-device speech model, so listening can fail there.

Other permissions
- Location: only "While Using the App", for the weather screen and weather notifications. To-dos work without it.
- Notifications: reminders and friend activity. The app explains them first, then shows the system alert.
- Photos (add only): the share sheet's "Save Image" for images you share.
- Photo library read: the purpose string exists because an included SDK references the API. Aido does not read the photo library.

Where to find other items
- Subscription price and period, Restore Purchases, Terms and Privacy: Me tab > Manage subscription.
- Account deletion: Delete account at the bottom of the Me tab. Web: https://aido.kr/en/account-deletion
- Report and block (Guideline 1.2): same as 1.14.0, from the ••• menu and Me tab > Manage friends. Contact: matthew@redband.co.kr
```

## Google Play: App content > App access and release notes for review

```text
Demo account
- Email:
- Password:

Sensitive permissions
- RECORD_AUDIO: only after someone taps the mic in the add to-do sheet, "Make a voice note" on the Memos tab, or the voice typing button in the subtask sheet. Denying it leaves typing and every other feature working. Speak to add and Voice notes stop listening when the app goes to the background or another screen opens. No foreground service records audio.
- ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION: foreground only, for the weather screen and weather notifications. There is no background location permission. The app requests balanced accuracy.
- POST_NOTIFICATIONS: reminders and friend activity.

Removed in 1.15.0 because Aido does not use them: USE_BIOMETRIC, USE_FINGERPRINT, SYSTEM_ALERT_WINDOW, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE.

Where voice and text go
- Speech recognition uses Android's speech service. It runs on the device when the language model is available for Speak to add and Voice notes. Otherwise, and for subtask voice typing, Google speech recognition may process the voice over the network.
- Voice notes saves audio on the device on Android 13 and above. Audio files aren't sent to Aido's servers. They are removed after 30 days, and can be deleted in Me tab > Recording storage. They may be part of device backups.
- Recognition hints: a fixed list of common words goes with network recognition. A person's category and to-do names go only with on-device recognition.
- After speech becomes text, the text goes to Aido's server and to AI providers (Anthropic Claude, Google Gemini, OpenAI) to organize it into to-dos or a summary. Our server does not store the transcript.

Consent
- Before AI features first send anything, a sheet lists what is sent, who receives it, how it is used, and how long it is kept. It requires tapping Agree. Not now or tapping outside sends nothing.
- Withdraw anytime: Me tab > Terms & policies > AI data sharing.

AI output
- AI turns the person's own words into suggested to-dos and summaries, and nothing is saved until they confirm it. They can report a problem from Me tab > Contact us.
- Places that use AI show an AI icon. There is no prompt on each use. When the monthly uses run out, a Premium dialog appears. Free accounts get 10 AI to-do uses and 3 voice notes a month.

How to test
1. Sign in with the demo account.
2. To-dos tab: open the add to-do sheet and tap the mic. Choose Agree, allow the microphone, then speak. Review the suggested to-dos and save the ones you want.
3. Memos tab: tap "Make a voice note", speak, stop, then summarize.

Test environment
- Voice features need a speech service, such as the Google app, and a working microphone. An emulator without them can't listen.
- Android 12 and below don't support continuous recognition or saved recordings, so listening can stop at a pause and there is no playback.
```
