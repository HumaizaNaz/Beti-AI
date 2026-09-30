# Generates the Urdu voice hints in public/audio with Microsoft Edge TTS (free).
# Usage: pip install edge-tts && python scripts/make-audio.py
# Replace any file later with a real human recording of the same name.
import asyncio
import pathlib

import edge_tts

VOICE = "ur-PK-UzmaNeural"
CLIPS = {
    "home-start": "سفر شروع کرنے کے لیے یہ بٹن دبائیں۔",
    "home-sos": "خطرہ ہو تو یہ لال بٹن دبائیں۔ آپ کے گھر والوں کو فوراً اطلاع جائے گی۔",
    "trip-photo": "گاڑی یا نمبر پلیٹ کی تصویر لیں۔ چاہیں تو چھوڑ بھی سکتی ہیں۔",
    "trip-time": "بتائیں سفر میں کتنی دیر لگے گی۔",
    "trip-go": "سفر شروع کرنے کے لیے یہ بٹن دبائیں اور مقام کی اجازت دیں۔",
    "trip-safe": "منزل پر پہنچ کر یہ ہرا بٹن دبائیں اور اپنا پن ڈالیں۔",
    "trip-extend": "مزید دس منٹ چاہییں تو یہ بٹن دبائیں اور پن ڈالیں۔",
    "pin-enter": "اپنا چار ہندسوں والا پن ڈالیں۔",
    "pin-wrong": "پن غلط ہے۔ دوبارہ کوشش کریں۔",
    "gps-help": "آپ کا مقام بند ہے۔ فون کی سیٹنگ میں لوکیشن آن کریں۔",
    "net-off": "انٹرنیٹ نہیں ہے۔ خطرہ ہو تو ایس ایم ایس کا بٹن دبائیں یا پندرہ پر کال کریں۔",
    "alert-help": "خطرے کی اطلاع! جس نے آپ کو رابطہ بنایا ہے اسے مدد چاہیے۔ نیچے اس کا مقام ہے۔ فوراً رابطہ کریں۔",
    "alert-test": "یہ صرف ٹیسٹ ہے۔ بیٹی اے آئی ٹھیک کام کر رہا ہے۔ پریشان نہ ہوں۔",
    "welcome-family": "شکریہ۔ آپ ایمرجنسی رابطہ بن گئے ہیں۔ خطرے کی صورت میں آپ کو یہاں اطلاع ملے گی۔",
    "setup-intro": "خوش آمدید۔ یہ سیٹ اپ صرف ایک بار ہوگا۔ کوئی مددگار آپ کی مدد کر سکتا ہے۔",
    "setup-pin": "چار ہندسوں کا حفاظتی پن بنائیں۔ یہ سفر ختم کرنے کے لیے ہے۔",
    "setup-duress": "اب ایک الگ خطرے والا پن بنائیں۔ اگر کوئی زبردستی کرے تو یہ پن ڈالیں۔ فون پر سب ٹھیک دکھے گا، مگر گھر والوں کو چپکے سے اطلاع جائے گی۔",
    "setup-contacts": "اپنے گھر والوں کو شامل کریں اور انہیں واٹس ایپ پر لنک بھیجیں۔",
    "help-page": "اگر آپ کا فون چوری ہو گیا ہے تو یہاں سے مدد مانگیں یا بتائیں کہ آپ ٹھیک ہیں۔",
}


async def main() -> None:
    out = pathlib.Path(__file__).resolve().parent.parent / "public" / "audio"
    out.mkdir(parents=True, exist_ok=True)
    for name, text in CLIPS.items():
        await edge_tts.Communicate(text, VOICE).save(str(out / f"{name}.mp3"))
        print("ok", name)


asyncio.run(main())
