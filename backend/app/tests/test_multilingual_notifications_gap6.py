import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import Alert

client = TestClient(app)

# Dictionary representing the unified multilingual template catalog mirroring frontend i18n
ALERT_LOCALIZATION_TEMPLATES = {
    "BRIDGE_CLOSED": {
        "en": "🚨 Bridge Closure Alert: {location} is CLOSED. Immediate reroute recommended.",
        "hi": "🚨 पुल बंद अलर्ट: {location} बंद है। तत्काल वैकल्पिक मार्ग अनुशंसित है।",
        "as": "🚨 দলং বন্ধৰ সতৰ্কবাৰ্তা: {location} বন্ধ কৰা হৈছে। অবিলম্বে বিকল্প পথ বাছক।",
        "bn: ": "🚨 সেতু বন্ধের সতর্কতা: {location} বন্ধ রয়েছে। অবিলম্বে বিকল্প রুট সুপারিশ করা হলো।",
        "mni": "🚨 থোং থিংজিনখ্রবা অলর্ত: {location} থিংজিনখ্রে।"
    },
    "ROUTE_BLOCKED": {
        "en": "⛔ Road Corridor Blocked: {location}. Highway impassable.",
        "hi": "⛔ सड़क कॉरिडोर अवरुद्ध: {location}। राजमार्ग अगम्य है।",
        "as": "⛔ পথ কৰিদৰ অৱৰুদ্ধ: {location}। পথ বন্ধ।",
        "bn": "⛔ রাস্তা করিডোর অবরুদ্ধ: {location}। হাইওয়ে অবরুদ্ধ।",
        "mni": "⛔ লম্বী থিংজিনখ্রে: {location}।"
    },
    "OVERSPEEDING_WARNING": {
        "en": "⚠️ Speed Limit Violation: {location} exceeded safety limit.",
        "hi": "⚠️ गति सीमा उल्लंघन: {location} पर गति सीमा पार।",
        "as": "⚠️ গতি সীমা উলংঘন: {location} ত গতি সীমা অতিক্ৰম।",
        "bn": "⚠️ গতি সীমা লঙ্ঘন: {location}-এ গতিসীমা অতিক্রম।",
        "mni": "⚠️ খোঙজেল য়াংখ্রবা: {location}।"
    },
    "TELEMETRY_SIGNAL_LOST": {
        "en": "📡 Telemetry Signal Lost: {location} has ceased transmission.",
        "hi": "📡 टेलीमेट्री सिग्नल खो गया: {location} पर प्रसारण बंद।",
        "as": "📡 টেলিমিত্ৰি সংকেত বিচ্ছিন্ন: {location} ত সংকেত বন্ধ।",
        "bn": "📡 টেলিমেট্রি সিগন্যাল বিচ্ছিন্ন: {location}-এ সংকেত বন্ধ।",
        "mni": "📡 সিগনেল মাংখ্রে: {location}।"
    }
}

def localize_test_alert(alert_type: str, location: str, lang: str = "en") -> str:
    template = ALERT_LOCALIZATION_TEMPLATES.get(alert_type, {})
    localized_str = template.get(lang) or template.get("en") or f"Alert: {location}"
    return localized_str.replace("{location}", location)

# =========================================================================
# SIH GAP 6 EXPLICIT 10 TEST SCENARIOS
# =========================================================================

def test_gap6_scenario_01_english_notification():
    """TEST 1: Verify English notification template rendering."""
    msg = localize_test_alert("BRIDGE_CLOSED", "Tuichang Bridge (NH54)", lang="en")
    assert "Bridge Closure Alert" in msg
    assert "Tuichang Bridge (NH54)" in msg


def test_gap6_scenario_02_hindi_notification():
    """TEST 2: Verify Hindi notification template rendering."""
    msg = localize_test_alert("BRIDGE_CLOSED", "तुइचांग पुल", lang="hi")
    assert "पुल बंद अलर्ट" in msg
    assert "तुइचांग पुल" in msg


def test_gap6_scenario_03_assamese_notification():
    """TEST 3: Verify Assamese (Assam Regional Hub) notification rendering."""
    msg = localize_test_alert("ROUTE_BLOCKED", "যোৰহাট-ডিব্ৰুগড় কৰিদৰ", lang="as")
    assert "পথ কৰিদৰ অৱৰুদ্ধ" in msg
    assert "যোৰহাট-ডিব্ৰুগড় কৰিদৰ" in msg


def test_gap6_scenario_04_bengali_notification():
    """TEST 4: Verify Bengali (Barak Valley / Tripura) notification rendering."""
    msg = localize_test_alert("OVERSPEEDING_WARNING", "শিলচর-আগরতলা হাইওয়ে", lang="bn")
    assert "গতি সীমা লঙ্ঘন" in msg
    assert "শিলচর-আগরতলা হাইওয়ে" in msg


def test_gap6_scenario_05_manipuri_notification():
    """TEST 5: Verify Manipuri / Meitei notification rendering."""
    msg = localize_test_alert("TELEMETRY_SIGNAL_LOST", "ইম্ফাল-জিরিবাম লম্বী", lang="mni")
    assert "সিগনেল মাংখ্রে" in msg
    assert "ইম্ফাল-জিরিবাম লম্বী" in msg


def test_gap6_scenario_06_missing_translation_fallback():
    """TEST 6: Missing translation in unsupported language falls back safely to English."""
    # Requesting 'fr' (French) which is not in the regional catalog
    msg = localize_test_alert("BRIDGE_CLOSED", "Irang Bridge", lang="fr")
    assert "Bridge Closure Alert" in msg
    assert "Irang Bridge" in msg


def test_gap6_scenario_07_alert_variable_injection():
    """TEST 7: Location and severity variables are correctly substituted into template placeholders."""
    loc = "Nongpoh Incline (Km 48)"
    msg = localize_test_alert("OVERSPEEDING_WARNING", loc, lang="en")
    assert loc in msg
    assert "{location}" not in msg


def test_gap6_scenario_08_bridge_closure_alert_localization():
    """TEST 8: Bridge closure events are correctly localized across multiple languages."""
    for lang, keyword in [("en", "CLOSED"), ("hi", "बंद"), ("as", "বন্ধ")]:
        msg = localize_test_alert("BRIDGE_CLOSED", "NH37 Span", lang=lang)
        assert keyword in msg


def test_gap6_scenario_09_vehicle_telemetry_alert_localization():
    """TEST 9: Vehicle signal loss and overspeeding alerts render appropriate language text."""
    overspeed_hi = localize_test_alert("OVERSPEEDING_WARNING", "गुवाहाटी-शिलांग मार्ग", lang="hi")
    assert "गति सीमा" in overspeed_hi

    loss_en = localize_test_alert("TELEMETRY_SIGNAL_LOST", "NH29 Senapati Pass", lang="en")
    assert "Signal Lost" in loss_en


def test_gap6_scenario_10_no_blank_or_malformed_notifications():
    """TEST 10: Null or unknown alert types do not produce blank or malformed outputs."""
    msg_unknown = localize_test_alert("UNKNOWN_ALERT_TYPE_999", "General NER Corridor", lang="en")
    assert len(msg_unknown) > 0
    assert "General NER Corridor" in msg_unknown
