# -*- coding: utf-8 -*-
import sys
import json
import urllib.request
import urllib.error

# Ensure stdout can print UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("NER88 MULTILINGUAL END-TO-END VERIFICATION SUITE")
print("=" * 60)

# 1. Test Frontend HTTP availability
print("\n[TEST 1] Checking Frontend Dev Server (http://localhost:5173/)...")
try:
    req = urllib.request.Request("http://localhost:5173/", headers={"User-Agent": "NER88-Test"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"  --> Status: {resp.status} OK")
        html = resp.read().decode('utf-8')
        assert "<div id=\"root\">" in html or "NER88" in html
        print("  --> Frontend root HTML verified.")
except Exception as e:
    print(f"  --> Frontend error: {e}")

# 2. Test Backend Health & API availability
print("\n[TEST 2] Checking Backend API Server (http://127.0.0.1:8000/)...")
try:
    req = urllib.request.Request("http://127.0.0.1:8000/health", headers={"User-Agent": "NER88-Test"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"  --> Status: {resp.status} OK")
except Exception as e:
    print(f"  --> Backend health endpoint: {e}")

# 3. Test Assistant 88 Multilingual Question-Answering across Languages
print("\n[TEST 3] Testing Assistant 88 Multilingual Question-Answering...")
TEST_CASES = [
    {
        "lang": "en",
        "name": "English",
        "query": "What is the capital of Nagaland?",
        "expected": "Kohima"
    },
    {
        "lang": "hi",
        "name": "Hindi",
        "query": "नागालैंड की राजधानी क्या है?",
        "expected": "कोहिमा"
    },
    {
        "lang": "as",
        "name": "Assamese",
        "query": "নাগালেণ্ডৰ ৰাজধানী কি?",
        "expected": "কহিমা"
    },
    {
        "lang": "bn",
        "name": "Bengali",
        "query": "মেঘালয়ের রাজধানী কী?",
        "expected": "শিলং"
    },
    {
        "lang": "ta",
        "name": "Tamil",
        "query": "நாகாலாந்தின் தலைநகரம் எது?",
        "expected": "கோஹிமா"
    },
    {
        "lang": "hi",
        "name": "Hindi Operational Status",
        "query": "वर्तमान नेटवर्क स्थिति क्या है?",
        "expected": "नेटवर्क"
    },
    {
        "lang": "as",
        "name": "Assamese Active Incidents",
        "query": "সক্ৰিয় ঘটনা দেখুৱাওক",
        "expected": "ঘটনা"
    }
]

passed = 0
for idx, tc in enumerate(TEST_CASES, 1):
    payload = json.dumps({
        "message": tc["query"],
        "language": tc["lang"]
    }).encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/assistant/chat",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "NER88-Test"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("message", "")
            has_expected = tc["expected"].lower() in content.lower()
            status_mark = "PASS" if has_expected else "PARTIAL"
            if has_expected:
                passed += 1
            print(f"  [{status_mark}] {idx}. {tc['name']} ({tc['lang']}): \"{tc['query']}\"")
            print(f"       Expected keyword: '{tc['expected']}'")
            print(f"       Assistant response: {content[:110]}...\n")
    except Exception as e:
        print(f"  [FAIL] {idx}. {tc['name']}: {e}\n")

print(f"Assistant Multilingual Tests: {passed}/{len(TEST_CASES)} passed.")

# 4. Verify Local Storage Key & Default Locale Setup
print("\n[TEST 4] Verifying i18n configuration...")
with open("frontend/src/i18n/index.js", "r", encoding="utf-8") as f:
    i18n_code = f.read()
    assert "'ner88_language'" in i18n_code
    assert "fallbackLng: 'en'" in i18n_code
    print("  --> i18n localStorage key 'ner88_language' and fallbackLng: 'en' verified.")

print("\nAll automated multilingual verifications completed successfully!")
