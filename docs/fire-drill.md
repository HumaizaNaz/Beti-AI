# Beti AI — Fire Drill (before launch and after every release)

Use a real cheap Android phone with Chrome, a second phone as "family" with Telegram, and a test Gmail. Tick every line three times.

## Setup
- [ ] Sign in with Google; the setup wizard runs in Urdu; 🔊 plays on every step.
- [ ] Add 2 contacts; send the invite on WhatsApp; each presses Start in Telegram; both turn ✅ within 5 s.
- [ ] 🧪 Test alert: both Telegram chats get the voice note + text; the email arrives; the app shows the count.

## Dead-Man's Switch
- [ ] Start a 10-min trip with a number-plate photo; do nothing.
- [ ] Within 1–2 minutes after the deadline, family gets: voice note, map pin, photo, text with live link, two buttons.
- [ ] Live link shows the red dot on the map; it moves while the phone moves.
- [ ] Press 🟢 on the phone + safe PIN → family gets "False alarm — she is safe".

## Normal trip
- [ ] Start trip → 🟢 + safe PIN before the deadline → family gets "reached safely"; no alert.
- [ ] +10 min with PIN moves the countdown by 10 minutes.

## Danger paths
- [ ] 🔴 Madad: family alerted within seconds, no PIN asked.
- [ ] Duress PIN at 🟢: phone shows ✅ exactly like normal; family gets the silent alert.
- [ ] Three wrong PINs: family gets "wrong PIN" alert; the 4th try says "locked 15 minutes".
- [ ] Calculator `9999=` while signed in: family alerted.

## Stolen phone
- [ ] From another phone, `/help` → 🔴 + number + PIN → family alerted.
- [ ] `/help` → ✅ "only my phone is gone" + callback number → family gets the message with that number; the open trip ends.
- [ ] Log in on the "stolen" phone: settings and contacts need the PIN.

## Failures
- [ ] Airplane mode + 🔴 → SMS app opens with both numbers and the map link; 📞 15 button works.
- [ ] Airplane mode during a trip for 2 minutes, then back online → the queued GPS points appear on the live map.
- [ ] Airplane mode + 🟢 + PIN → SMS "I reached safely" offered; back online → trip ends within 20 s.
- [ ] One family member blocks the bot → the home screen shows ⚠️ 1 disconnected; alerts still reach the other.
- [ ] Remove all contacts' Telegram + email → 🔴 shows the red "Alert not sent — call 15" screen.
- [ ] UptimeRobot shows the monitor green.
