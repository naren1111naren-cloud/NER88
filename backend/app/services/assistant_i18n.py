"""
Assistant 88 Multilingual Intelligence Layer.
Provides multilingual intent matching, query translation, and deterministic response
generation in English, Hindi, Assamese, Bengali, Tamil, Odia, Nepali, Meitei, Mizo, Bodo.
"""
from typing import Dict, Any, Optional, Tuple, List
import re

# State & Capital Localization Dictionary
STATE_CAPITALS = {
    "nagaland": {
        "en": ("Kohima", "Nagaland", "situated on the NH-29 arterial corridor connecting Dimapur to Imphal"),
        "hi": ("कोहिमा", "नागालैंड", "दीमापुर को इंफाल से जोड़ने वाले NH-29 मुख्य कॉरिडोर पर स्थित"),
        "as": ("কহিমা", "নাগালেণ্ড", "ডিমাপুৰক ইম্ফলৰ সৈতে সংযোগ কৰা NH-29 মূল কৰিডৰত অৱস্থিত"),
        "bn": ("কোহিমা", "নাগাল্যান্ড", "দিমাপুরের সাথে ইম্ফল সংযোগকারী NH-29 প্রধান করিডোরে অবস্থিত"),
        "ta": ("கோஹிமா", "நாகாலாந்து", "திமாபூரை இம்பாலுடன் இணைக்கும் NH-29 தேசிய நெடுஞ்சாலையில் அமைந்துள்ளது"),
        "or": ("କୋହିମା", "ନାଗାଲାଣ୍ଡ", "ଡିମାପୁରକୁ ଇମ୍ଫାଲ ସହ ସଂଯୋଗ କରୁଥିବା NH-29 ମୁଖ୍ୟ କରିଡରରେ ଅବସ୍ଥିତ"),
        "ne": ("कोहिमा", "नागाल्याण्ड", "दीमापुरलाई इम्फालसँग जोड्ने NH-29 मुख्य करिडोरमा अवस्थित"),
        "mni": ("কোন্হিমা", "নাগালেন্দ", "দিমাপুর অমসুং ইম্ফাল শম্নহনবা NH-29 লম্বীদা লৈবা"),
        "lus": ("Kohima", "Nagaland", "NH-29 kawngpui Dimapur leh Imphal thlunzawmtu chunga awm"),
        "brx": ("खहिमा", "नागालेण्ड", "दिमापुरनिफ्राय इमफाल सिम दाजाबग्रा NH-29 लामायाव थानाय")
    },
    "assam": {
        "en": ("Dispur", "Assam", "a designated capital complex in Guwahati, the principal regional logistics hub"),
        "hi": ("दिसपुर", "असम", "गुवाहाटी में स्थित राजधानी परिसर, जो प्रमुख क्षेत्रीय रसद केंद्र है"),
        "as": ("দিছপুৰ", "অসম", "গুৱাহাটীৰ প্ৰধান আঞ্চলিক লজিষ্টিক হাবৰ ৰাজধানী অঞ্চল"),
        "bn": ("দিসপুর", "অসম", "গুয়াহাটির প্রধান আঞ্চলিক লজিস্টিক হাবের রাজধানী এলাকা"),
        "ta": ("திஸ்பூர்", "அசாம்", "பிராந்திய முக்கிய மையமான குவஹாத்தியில் உள்ள தலைநகர வளாகம்"),
        "or": ("ଦିସପୁର", "ଆସାମ", "ଗୁଆହାଟୀରେ ଥିବା ପ୍ରମୁଖ ଆଞ୍ଚଳିକ ଲଜିଷ୍ଟିକ୍ସ ହବ୍ ଅନ୍ତର୍ଗତ"),
        "ne": ("दिसपुर", "आसाम", "गुवाहाटीमा अवस्थित प्रमुख क्षेत्रीय लजिस्टिक्स केन्द्र"),
        "mni": ("দিসপুর", "অসাম", "গুৱাহাটিদা লৈবা প্রধান লজিস্তিক্স হব"),
        "lus": ("Dispur", "Assam", "Guwahati khawpui chhung a logistics hub pawimawh"),
        "brx": ("दिसपुर", "आसाम", "गुवाहाटी सहरनि सिंआव थानाय गाहाय राजधानी")
    },
    "meghalaya": {
        "en": ("Shillong", "Meghalaya", "located in the East Khasi Hills along the strategic NH-6 corridor"),
        "hi": ("शिलांग", "मेघालय", "रणनीतिक NH-6 कॉरिडोर के साथ पूर्वी खासी हिल्स में स्थित"),
        "as": ("শ্বিলং", "মেঘালয়", "কৌশলগত NH-6 কৰিডৰৰ কাষত পূব খাচী পাহাৰত অৱস্থিত"),
        "bn": ("শিলং", "মেঘালয়", "কৌশলগত NH-6 করিডোরের কাছে পূর্ব খাসি পাহাড়ে অবস্থিত"),
        "ta": ("ஷில்லாங்", "மேகாலயா", "NH-6 நெடுஞ்சாலை பகுதியில் கிழக்கு காசி மலைகளில் அமைந்துள்ளது"),
        "or": ("ଶିଲଂ", "ମେଘାଳୟ", "ରଣନୈତିକ NH-6 କରିଡର ନିକଟସ୍ଥ ପୂର୍ବ ଖାସି ପାହାଡ଼ରେ ଅବସ୍ଥିତ"),
        "ne": ("शिलोङ", "मेघालय", "रणनीतिक NH-6 करिडोर नजिक पूर्व खासी हिल्समा अवस्थित"),
        "mni": ("শিলং", "মেঘালয়", "NH-6 লম্বীগী মনাক্তা ইস্ত খাসী হিলসতা লৈবা"),
        "lus": ("Shillong", "Meghalaya", "East Khasi Hills-a NH-6 kawngpui bula awm"),
        "brx": ("शिलंग", "मेघालय", "सानजा खासि हाजोनि NH-6 लामायाव थानाय")
    },
    "manipur": {
        "en": ("Imphal", "Manipur", "located in the central valley, connected via NH-2 and NH-37 corridors"),
        "hi": ("इंफाल", "मणिपुर", "केंद्रीय घाटी में स्थित, NH-2 और NH-37 कॉरिडोर से जुड़ा"),
        "as": ("ইম্ফল", "মণিপুৰ", "কেন্দ্ৰীয় উপত্যকাত অৱস্থিত, NH-2 আৰু NH-37 কৰিডৰেৰে সংযোজিত"),
        "bn": ("ইম্ফল", "মণিপুর", "কেন্দ্রীয় উপত্যকায় অবস্থিত, NH-2 এবং NH-37 করিডোর দ্বারা সংযুক্ত"),
        "ta": ("இம்பால்", "மணிப்பூர்", "மத்திய பள்ளத்தாக்கில் அமைந்துள்ள NH-2 மற்றும் NH-37 நெடுஞ்சாலைகள் மூலம் இணைக்கப்பட்டுள்ளது"),
        "or": ("ଇମ୍ଫାଲ", "ମଣିପୁର", "କେନ୍ଦ୍ରୀୟ ଉପତ୍ୟକାରେ ଅବସ୍ଥିତ, NH-2 ଓ NH-37 ଦ୍ୱାରା ସଂଯୁକ୍ତ"),
        "ne": ("इम्फाल", "मणिपुर", "केन्द्रीय उपत्यकामा अवस्थित, NH-2 र NH-37 करिडोरद्वारा जोडिएको"),
        "mni": ("ইম্ফাল", "মণিপুর", "ময়াইগী তম্পাক্তা লৈবা, NH-2 অমসুং NH-37 লম্বীনা শম্নহনবা"),
        "lus": ("Imphal", "Manipur", "phaizawl laili-a awm, NH-2 leh NH-37 kawngpuiin a thlunzawm"),
        "brx": ("इमफाल", "मणिपुर", "गेजेर हायेननि NH-2 आरो NH-37 लामाजों सोमोन्दो थानाय")
    },
    "mizoram": {
        "en": ("Aizawl", "Mizoram", "perched on a mountain ridge at 1,132m elevation along NH-54"),
        "hi": ("आइज़ोल", "मिजोरम", "NH-54 के साथ 1,132 मीटर की ऊंचाई पर एक पहाड़ी रिज पर स्थित"),
        "as": ("আইজল", "মিজোৰাম", "NH-54 ৰ কাষত ১,১৩২ মিটাৰ উচ্চতাত পাহাৰৰ শৃংগত অৱস্থিত"),
        "bn": ("আইজল", "মিজোরাম", "NH-54 বরাবর ১,১৩২ মিটার উচ্চতায় পাহাড়ের চূড়ায় অবস্থিত"),
        "ta": ("ஐஸ்வால்", "மிசோரம்", "NH-54 வழியே 1,132 மீட்டர் உயரத்தில் மலை முகட்டில் அமைந்துள்ளது"),
        "or": ("ଆଇଜଲ", "ମିଜୋରାମ", "NH-54 କଡ଼ରେ ୧,୧୩୨ ମିଟର ଉଚ୍ଚ ପାହାଡ଼ ଉପରେ ଅବସ୍ଥିତ"),
        "ne": ("आईजोल", "मिजोरम", "NH-54 करिडोरमा १,१३२ मिटरको उचाइमा पहाडमा अवस्थित"),
        "mni": ("আইজোল", "মিজোরাম", "NH-54 লম্বীদা ১,১৩২ মিতর ৱাংবা চিংদা লৈবা"),
        "lus": ("Aizawl", "Mizoram", "NH-54 kawngpui zuiin tlangsang feet 3,700 (1,132m)-a awm"),
        "brx": ("आईजल", "मिजोरम", "NH-54 लामायाव 1,132 मिटर जौथायाव हाजो सायाव थानाय")
    },
    "tripura": {
        "en": ("Agartala", "Tripura", "situated in the plains near the Howrah River, accessed via NH-8"),
        "hi": ("अगरतला", "त्रिपुरा", "हावड़ा नदी के पास मैदानों में स्थित, NH-8 के माध्यम से पहुंचा जाता है"),
        "as": ("আগৰতলা", "ত্ৰিপুৰা", "হাওৰা নদীৰ ওচৰৰ সমতলত অৱস্থিত, NH-8 ৰে সুগম"),
        "bn": ("আগরতলা", "ত্রিপুরা", "হাওড়া নদীর নিকটবর্তী সমভূমিতে অবস্থিত, NH-8 দ্বারা যুক্ত"),
        "ta": ("அகர்தலா", "திரிபுரா", "ஹவுரா ஆற்றின் அருகில் சமவெளியில் NH-8 வழியே அமைந்துள்ளது"),
        "or": ("ଅଗରତାଲା", "ତ୍ରିପୁରା", "ହାଓଡ଼ା ନଦୀ ନିକଟସ୍ଥ ସମତଳ ଅଞ୍ଚଳରେ NH-8 ମାଧ୍ୟମରେ ସଂଯୁକ୍ତ"),
        "ne": ("अगरतला", "त्रिपुरा", "हावड़ा नदी नजिक समथर भूमिमा NH-8 मार्फत जोडिएको"),
        "mni": ("অগরতলা", "ত্রিপুরা", "হাওড়া তুরেল মনাক্তা NH-8 লম্বীনা শম্নহনবা"),
        "lus": ("Agartala", "Tripura", "Howrah luipui bula phai hmuna awm, NH-8 hmanga kalpawh"),
        "brx": ("आगरतला", "त्रिपुरा", "हावड़ा दैसा सेरनि हायेनाव NH-8 लामाजों सोमोन्दो थानाय")
    },
    "arunachal": {
        "en": ("Itanagar", "Arunachal Pradesh", "located in the Himalayan foothills along NH-415"),
        "hi": ("ईटानगर", "अरुणाचल प्रदेश", "NH-415 के साथ हिमालय की तलहटी में स्थित"),
        "as": ("ইটানগৰ", "অৰুণাচল প্ৰদেশ", "NH-415 ৰ কাষত হিমালয়ৰ পাদদেশত অৱস্থিত"),
        "bn": ("ইটানগর", "অরুণাচল প্রদেশ", "NH-415 বরাবর হিমালয়ের পাদদেশে অবস্থিত"),
        "ta": ("இட்டாநகர்", "அருணாச்சல பிரதேசம்", "இமயமலை அடிவாரத்தில் NH-415 வழியே அமைந்துள்ளது"),
        "or": ("ଇଟାନଗର", "ଅରୁଣାଚଳ ପ୍ରଦେଶ", "NH-415 ସହିତ ହିମାଳୟ ପାଦଦେଶରେ ଅବସ୍ଥିତ"),
        "ne": ("ईटानगर", "अरुणाचल प्रदेश", "NH-415 सँगै हिमालयको काखमा अवस्थित"),
        "mni": ("ইটানগর", "অরুণাচল প্রদেশ", "হিমালয় চিংগী ময়াদা NH-415 লম্বীদা লৈবা"),
        "lus": ("Itanagar", "Arunachal Pradesh", "Himalaya tlang bulṭhut-ah NH-415 zuiin a awm"),
        "brx": ("इटानगर", "अरुणाचल प्रदेश", "हिमालय हाजो सेरनि NH-415 लामायाव थानाय")
    },
    "sikkim": {
        "en": ("Gangtok", "Sikkim", "situated in the Eastern Himalayas along the arterial NH-10 corridor"),
        "hi": ("गंगटोक", "सिक्किम", "मुख्य NH-10 कॉरिडोर के साथ पूर्वी हिमालय में स्थित"),
        "as": ("গেংটক", "ছিকিম", "প্ৰধান NH-10 কৰিডৰৰ কাষত পূব হিমালয়ত অৱস্থিত"),
        "bn": ("গ্যাংটক", "সিকিম", "প্রধান NH-10 করিডোর বরাবর পূর্ব হিমালয়ে অবস্থিত"),
        "ta": ("காங்டாக்", "சிக்கிம்", "கிழக்கு இமயமலையில் NH-10 முக்கிய நெடுஞ்சாலையில் அமைந்துள்ளது"),
        "or": ("ଗ୍ୟାଙ୍ଗଟକ", "ସିକ୍କିମ", "ମୁଖ୍ୟ NH-10 କରିଡର ସହିତ ପୂର୍ବ ହିମାଳୟରେ ଅବସ୍ଥିତ"),
        "ne": ("गान्तोक", "सिक्किम", "मुख्य NH-10 करिडोरसँगै पूर्वी हिमालयमा अवस्थित"),
        "mni": ("গংতোক", "সিক্কিম", "নোংপোক হিমালয়দা NH-10 লম্বীদা লৈবা"),
        "lus": ("Gangtok", "Sikkim", "Eastern Himalaya-ah NH-10 kawngpui pawimawh zuiin a awm"),
        "brx": ("गांतक", "सिक्किम", "सानजा हिमालयनि NH-10 गाहाय लामायाव थानाय")
    }
}

# State name mapping from multilingual queries
STATE_ALIASES = {
    "nagaland": ["nagaland", "नागालैंड", "नागालँड", "নাগালেণ্ড", "নাগাল্যান্ড", "நாகாலாந்து", "நாகாலாந்தின்", "நாகாலாந்", "ନାଗାଲାଣ୍ଡ", "नागाल्याण्ड"],
    "assam": ["assam", "असम", "असोम", "অসম", "অসম", "அசாம்", "அசாமின்", "ଆସାମ", "आसाम"],
    "meghalaya": ["meghalaya", "मेघालय", "মেঘালয়", "மேகாலயா", "மேகாலயாவின்", "ମେଘାଳୟ"],
    "manipur": ["manipur", "मणिपुर", "মণিপুৰ", "মণিপুর", "மணிப்பூர்", "மணிப்பூரின்", "ମଣିପୁର"],
    "mizoram": ["mizoram", "मिजोरम", "মিজোৰাম", "মিজোরাম", "மிசோரம்", "மிசோரமின்", "ମିଜୋରାମ"],
    "tripura": ["tripura", "त्रिपुरा", "ত্ৰিপুৰা", "ত্রিপুরা", "திரிபுரா", "திரிபுராவின்", "ତ୍ରିପୁରା"],
    "arunachal": ["arunachal", "arunachal pradesh", "अरुणाचल", "अरुणाचल प्रदेश", "অৰুণাচল", "অরুণাচল", "அருணாச்சல", "அருணாச்சலப்", "ଅରୁଣାଚଳ"],
    "sikkim": ["sikkim", "सिक्किम", "ছিকিম", "সিকিম", "சிக்கிம்", "சிக்கிமின்", "ସିକ୍କିମ"]
}

# Capital query keywords
CAPITAL_KEYWORDS = [
    "capital", "rajdhani", "राजधानी", "ৰাজধানী", "রাজধানী", 
    "தலைநகரம்", "தலைநகர்", "ରାଜଧାନୀ", "কোন্নাপুং", "khawpui"
]

def detect_language(query: str, default_lang: str = "en") -> str:
    """Infers language from query script or keeps requested language."""
    if default_lang and default_lang != "en":
        return default_lang

    # Devanagari script (Hindi, Nepali)
    if re.search(r'[\u0900-\u097F]', query):
        return "hi"
    # Bengali / Assamese script
    if re.search(r'[\u0980-\u09FF]', query):
        # Check for Assamese specific characters 'ৰ' (U+09F0) and 'ৱ' (U+09F1)
        if re.search(r'[\u09F0\u09F1]', query):
            return "as"
        return "bn"
    # Tamil script
    if re.search(r'[\u0B80-\u0BFF]', query):
        return "ta"
    # Odia script
    if re.search(r'[\u0B00-\u0B7F]', query):
        return "or"

    return default_lang or "en"


def match_state_capital_query(query: str, lang: str = "en") -> Optional[Dict[str, Any]]:
    """Answers capital queries deterministically across all supported languages."""
    q_lower = query.lower()
    
    # 1. Check if query asks for a capital
    is_capital_query = any(k in q_lower for k in CAPITAL_KEYWORDS)
    if not is_capital_query:
        return None

    # 2. Find target state
    matched_state_key = None
    for state_key, aliases in STATE_ALIASES.items():
        if any(alias in q_lower for alias in aliases):
            matched_state_key = state_key
            break

    if not matched_state_key:
        return None

    target_lang = lang if lang in ["hi", "as", "bn", "ta", "or", "ne", "mni", "lus", "brx"] else "en"
    state_data = STATE_CAPITALS.get(matched_state_key, {}).get(target_lang) or STATE_CAPITALS.get(matched_state_key, {}).get("en")
    if not state_data:
        return None

    cap_name, full_state, desc = state_data

    # Localized template responses
    if target_lang == "hi":
        msg = f"**{cap_name}**, {full_state} की राजधानी है।\n\nयह {desc} है।"
    elif target_lang == "as":
        msg = f"**{cap_name}** হ'ল {full_state}ৰ ৰাজধানী।\n\nই {desc}।"
    elif target_lang == "bn":
        msg = f"**{cap_name}** হলো {full_state}-এর রাজধানী।\n\nএটি {desc}।"
    elif target_lang == "ta":
        msg = f"**{cap_name}** என்பது {full_state} மாநிலத்தின் தலைநகரம் ஆகும்.\n\nஇது {desc}."
    elif target_lang == "or":
        msg = f"**{cap_name}** ହେଉଛି {full_state}ର ରାଜଧାନୀ।\n\nଏହା {desc}।"
    elif target_lang == "ne":
        msg = f"**{cap_name}** {full_state}को राजधानी हो।\n\nयो {desc}।"
    elif target_lang == "mni":
        msg = f"**{cap_name}** অসি {full_state}গী কোনুংনি।\n\nমসি {desc}।"
    elif target_lang == "lus":
        msg = f"**{cap_name}** hi {full_state} khawpui a ni.\n\n{desc}."
    elif target_lang == "brx":
        msg = f"**{cap_name}** आ {full_state}नि राजधानी।\n\nबेयो {desc}।"
    else:
        msg = f"**{cap_name}** is the capital of {full_state}.\n\nIt is {desc}."

    return {
        "message": msg,
        "sources": ["NER_GEOGRAPHICAL_REGISTRY"],
        "metrics": {"state": full_state, "capital": cap_name},
        "recommendations": [],
        "actions": [],
        "context": {"state": matched_state_key}
    }


def format_corridors_response(corridors: List[Any], status_type: str, lang: str = "en") -> Dict[str, Any]:
    """Generates localized corridor status responses (BLOCKED or RESTRICTED) from live DB data."""
    target_lang = lang if lang in ["hi", "as", "bn", "ta", "or", "ne", "mni", "lus", "brx"] else "en"
    count = len(corridors)

    if count == 0:
        msgs = {
            "en": f"✅ **No {status_type.capitalize()} Corridors:** All monitored arterial corridors in Northeast India are currently clear.",
            "hi": f"✅ **कोई {status_type} कॉरिडोर नहीं:** पूर्वोत्तर भारत में सभी निगरानी वाले मुख्य कॉरिडोर वर्तमान में सुचारू हैं।",
            "as": f"✅ **কোনো {status_type} কৰিডৰ নাই:** উত্তৰ-পূব ভাৰতৰ সকলো পৰ্যবেক্ষিত কৰিডৰ সম্প্ৰতি মুক্ত।",
            "bn": f"✅ **কোনো {status_type} করিডোর নেই:** উত্তর-পূর্ব ভারতের সমস্ত পর্যবেক্ষণাধীন করিডোর বর্তমানে সচল।",
            "ta": f"✅ **தடைபட்ட பாதைகள் இல்லை:** வடகிழக்கு இந்தியாவின் அனைத்து கண்காணிக்கப்படும் பாதைகளும் தற்போது தெளிவாக உள்ளன.",
            "or": f"✅ **କୌଣସି ଅବରୋଧିତ କରିଡର ନାହିଁ:** ଉତ୍ତର-ପୂର୍ବ ଭାରତର ସମସ୍ତ ମୁଖ୍ୟ କରିଡର ବର୍ତ୍ତମାନ ଚଳାଚଳ ଯୋଗ୍ୟ।"
        }
        msg = msgs.get(target_lang, msgs["en"])
        return {
            "message": msg,
            "sources": ["DATABASE_CORRIDORS"],
            "metrics": {f"{status_type.lower()}_corridors_count": 0},
            "recommendations": ["Maintain freight telemetry monitoring"],
            "actions": [{"type": "NAVIGATE", "payload": {"route": "/routes"}}]
        }

    # Headers
    headers = {
        "en": f"**{count} corridor{'s are' if count != 1 else ' is'} currently {status_type.lower()}:**\n",
        "hi": f"**वर्तमान में {count} कॉरिडोर {status_type} हैं:**\n",
        "as": f"**সম্প্ৰতি {count} টা কৰিডৰ {status_type}:**\n",
        "bn": f"**বর্তমানে {count} টি করিডোর {status_type}:**\n",
        "ta": f"**தற்போது {count} பாதைகள் {status_type}:**\n",
        "or": f"**ବର୍ତ୍ତମାନ {count} ଟି କରିଡର {status_type}:**\n"
    }

    cause_labels = {
        "en": "Cause",
        "hi": "कारण",
        "as": "কাৰণ",
        "bn": "কারণ",
        "ta": "காரணம்",
        "or": "କାରଣ"
    }

    lines = [headers.get(target_lang, headers["en"])]
    actions = []

    icon = "🔴" if status_type.upper() == "BLOCKED" else "🟠"
    c_label = cause_labels.get(target_lang, cause_labels["en"])

    for c in corridors:
        state_info = f" — {c.states_covered}" if getattr(c, 'states_covered', None) else ""
        lines.append(f"• {icon} **{c.corridor_code}** ({c.name}){state_info}")
        if getattr(c, 'reason', None):
            delay_info = f" (Delay: `+{c.estimated_delay_mins}m`)" if getattr(c, 'estimated_delay_mins', None) else ""
            lines.append(f"  *{c_label}:* {c.reason}{delay_info}")
        actions.append({"type": "FOCUS_CORRIDOR", "payload": {"corridor_code": c.corridor_code, "corridor": c.corridor_code}})

    actions.append({"type": "NAVIGATE", "payload": {"route": "/routes"}})

    return {
        "message": "\n".join(lines),
        "sources": ["DATABASE_CORRIDORS", "DISRUPTION_ENGINE"],
        "metrics": {f"{status_type.lower()}_corridors_count": count},
        "recommendations": ["Engage designated detour bypasses", "Review affected vehicles in Command Center"],
        "actions": actions
    }


def format_incidents_response(incidents: List[Any], lang: str = "en") -> Dict[str, Any]:
    """Generates localized incident summaries from real DB data."""
    target_lang = lang if lang in ["hi", "as", "bn", "ta", "or", "ne", "mni", "lus", "brx"] else "en"
    count = len(incidents)

    if count == 0:
        msgs = {
            "en": "✅ **No Active Incidents:** All regional transport corridors report zero critical ground obstructions.",
            "hi": "✅ **कोई सक्रिय घटना नहीं:** सभी क्षेत्रीय परिवहन कॉरिडोर में शून्य गंभीर जमीनी अवरोध दर्ज किए गए हैं।",
            "as": "✅ **কোনো সক্ৰিয় ঘটনা নাই:** সকলো আঞ্চলিক পৰিবহণ কৰিডৰত শূন্য গুৰুতৰ বাধা নথিভুক্ত হৈছে।",
            "bn": "✅ **কোনো সক্রিয় ঘটনা নেই:** সমস্ত আঞ্চলিক পরিবহন করিডোরে শূন্য সংকটপূর্ণ বাধা রেকর্ড করা হয়েছে।",
            "ta": "✅ **செயலில் உள்ள சம்பவங்கள் இல்லை:** அனைத்து பிராந்திய போக்குவரத்து பாதைகளிலும் பூஜ்ஜிய தடைகள் பதிவாகியுள்ளன.",
            "or": "✅ **କୌଣସି ସକ୍ରିୟ ଘଟଣା ନାହିଁ:** ସମସ୍ତ ଆଞ୍ଚଳିକ ପରିବହନ କରିଡରରେ ଶୂନ ଗୁରୁତର ବାଧା ରେକର୍ଡ ହୋଇଛି।"
        }
        return {
            "message": msgs.get(target_lang, msgs["en"]),
            "sources": ["DATABASE_INCIDENTS"],
            "metrics": {"active_incidents_count": 0},
            "recommendations": ["Continue standard telemetry monitoring"],
            "actions": [{"type": "NAVIGATE", "payload": {"route": "/incidents"}}]
        }

    headers = {
        "en": f"⚠️ **{count} Active Logistics Disruption{'s' if count != 1 else ''} Recorded:**\n",
        "hi": f"⚠️ **{count} सक्रिय रसद व्यवधान दर्ज किए गए:**\n",
        "as": f"⚠️ **{count} টা সক্ৰিয় লজিষ্টিক বিঘিনি নথিভুক্ত কৰা হৈছে:**\n",
        "bn": f"⚠️ **{count} টি সক্রিয় লজিস্টিক বিঘ্ন রেকর্ড করা হয়েছে:**\n",
        "ta": f"⚠️ **{count} செயலில் உள்ள போக்குவரத்து இடையூறுகள் பதிவாகியுள்ளன:**\n",
        "or": f"⚠️ **{count} ଟି ସକ୍ରିୟ ଲଜିଷ୍ଟିକ୍ସ ବ୍ୟାଘାତ ରେକର୍ଡ ହୋଇଛି:**\n"
    }

    lines = [headers.get(target_lang, headers["en"])]
    actions = []
    for inc in incidents[:6]:
        lines.append(f"• ⚠️ **{inc.incident_type}** at `{inc.location_name}` ({inc.severity})")
        if getattr(inc, 'description', None):
            lines.append(f"  *{inc.description}*")
        actions.append({"type": "VIEW_INCIDENT", "payload": {"incident_id": inc.id}})

    actions.append({"type": "NAVIGATE", "payload": {"route": "/incidents"}})

    return {
        "message": "\n".join(lines),
        "sources": ["DATABASE_INCIDENTS"],
        "metrics": {"active_incidents_count": count},
        "recommendations": ["Initiate emergency detour dispatch", "Dispatch field verification officers"],
        "actions": actions
    }


def format_weather_response(high_rain_districts: List[Any], lang: str = "en") -> Dict[str, Any]:
    """Generates localized weather risk responses from real DB & live Open-Meteo telemetry."""
    target_lang = lang if lang in ["hi", "as", "bn", "ta", "or", "ne", "mni", "lus", "brx"] else "en"
    count = len(high_rain_districts)

    if count == 0:
        msgs = {
            "en": "🌤️ **Moderate Regional Weather Risk:** Precipitation levels across all 8 Northeast states remain within baseline operational thresholds.",
            "hi": "🌤️ **मध्यम क्षेत्रीय मौसम जोखिम:** सभी 8 पूर्वोत्तर राज्यों में वर्षा का स्तर सामान्य परिचालन सीमा के भीतर है।",
            "as": "🌤️ **মধ্যমীয়া আঞ্চলিক বতৰৰ আশংকা:** আটাইকেইখন উত্তৰ-পূব ৰাজ্যতে বৰষুণৰ পৰিমাণ সাধাৰণ সীমাৰ ভিতৰত আছে।",
            "bn": "🌤️ **মাঝারি আঞ্চলিক আবহাওয়া ঝুঁকি:** উত্তর-পূর্বের ৮টি রাজ্যেই বৃষ্টিপাতের পরিমাণ স্বাভাবিক সীমার মধ্যে রয়েছে।",
            "ta": "🌤️ **மிதமான வானிலை ஆபத்து:** அனைத்து 8 வடகிழக்கு மாநிலங்களிலும் மழைப்பொழிவு இயல்பு நிலையில் உள்ளது.",
            "or": "🌤️ **ମଧ୍ୟମ ଆଞ୍ଚଳିକ ପାଣିପାଗ ବିପଦ:** ସମସ୍ତ ୮ଟି ଉତ୍ତର-ପୂର୍ବ ରାଜ୍ୟରେ ବର୍ଷା ସାଧାରଣ ସୀମା ମଧ୍ୟରେ ଅଛି।"
        }
        return {
            "message": msgs.get(target_lang, msgs["en"]),
            "sources": ["LIVE_OPEN_METEO_TELEMETRY"],
            "metrics": {"high_risk_weather_districts": 0},
            "recommendations": ["Maintain standard telemetry monitoring"],
            "actions": [{"type": "NAVIGATE", "payload": {"route": "/weather"}}]
        }

    headers = {
        "en": f"🌧️ **Active Meteorological Hazards Detected ({count} High Precipitation Sectors):**\n",
        "hi": f"🌧️ **सक्रिय मौसम संबंधी खतरे पाए गए ({count} उच्च वर्षा क्षेत्र):**\n",
        "as": f"🌧️ **সক্ৰিয় বতৰৰ বিপদ ধৰা পৰিছে ({count} টা প্ৰবল বৃষ্টিপাত হোৱা খণ্ড):**\n",
        "bn": f"🌧️ **সক্রিয় আবহাওয়া সংক্রান্ত বিপদ শনাক্ত হয়েছে ({count} টি ভারী বৃষ্টিপাত অঞ্চল):**\n",
        "ta": f"🌧️ **வானிலை ஆபத்துகள் கண்டறியப்பட்டன ({count} அதிக மழைப்பொழிவு பகுதிகள்):**\n",
        "or": f"🌧️ **ସକ୍ରିୟ ପାଣିପାଗ ବିପଦ ଚିହ୍ନଟ ହୋଇଛି ({count} ଟି ଅଧିକ ବର୍ଷା ଅଞ୍ଚଳ):**\n"
    }

    lines = [headers.get(target_lang, headers["en"])]
    for d in high_rain_districts[:5]:
        rain_val = getattr(d, 'rainfall_mm', 0)
        lines.append(f"• 🌧️ **{d.name}** ({getattr(d, 'state', 'Northeast')}) — `{rain_val} mm/24h` precipitation")

    lines.append("\nHigh precipitation severely elevates slope saturation and flash-flood susceptibility on mountain highways.")
    return {
        "message": "\n".join(lines),
        "sources": ["LIVE_OPEN_METEO_TELEMETRY", "WEATHER_RISK_ENGINE"],
        "metrics": {"high_risk_weather_districts": count},
        "recommendations": ["Enforce low-speed convoy protocols on saturated mountain curves", "Monitor landslide prone road segments"],
        "actions": [{"type": "NAVIGATE", "payload": {"route": "/weather"}}]
    }


def format_affected_vehicles_response(vehicles: List[Any], corridor_code: Optional[str] = None, lang: str = "en") -> Dict[str, Any]:
    """Generates localized vehicle impact summaries from real DB records."""
    target_lang = lang if lang in ["hi", "as", "bn", "ta", "or", "ne", "mni", "lus", "brx"] else "en"
    count = len(vehicles)

    if count == 0:
        msgs = {
            "en": f"🚛 **No Vehicles Stranded:** Zero commercial freight consignments are currently halted at bottlenecks{' on ' + corridor_code if corridor_code else ''}.",
            "hi": f"🚛 **कोई वाहन फंसा नहीं:** कोई भी वाणिज्यिक माल वाहन वर्तमान में बाधाओं पर रुका नहीं है{' ' + corridor_code + ' पर' if corridor_code else ''}।",
            "as": f"🚛 **কোনো বাহন আৱদ্ধ হৈ থকা নাই:** বৰ্তমান কোনো বাণিজ্যিক সামগ্ৰী পৰিবহণ কৰা বাহন আৱদ্ধ হৈ থকা নাই{' ' + corridor_code + ' ত' if corridor_code else ''}।",
            "bn": f"🚛 **কোনো যানবাহন আটকে নেই:** বর্তমানে কোনো বাণিজ্যিক মালবাহী গাড়ি আটকে নেই{' ' + corridor_code + ' এ' if corridor_code else ''}।",
            "ta": f"🚛 **சிக்கிய வாகனங்கள் இல்லை:** சரக்கு வாகனங்கள் எதுவும் பாதைகளில் நிறுத்தப்படவில்லை.",
            "or": f"🚛 **କୌଣସି ଯାନବାହାନ ଫସି ନାହିଁ:** କୌଣସି ମାଲବାହୀ ଗାଡ଼ି ବର୍ତ୍ତମାନ ଅଟକି ନାହିଁ।"
        }
        return {
            "message": msgs.get(target_lang, msgs["en"]),
            "sources": ["VAHAN_TELEMETRY_STREAM", "DATABASE_VEHICLES"],
            "metrics": {"affected_vehicles_count": 0},
            "recommendations": ["Corridor path is clear for transit"],
            "actions": [{"type": "NAVIGATE", "payload": {"route": "/vehicles"}}]
        }

    headers = {
        "en": f"🚛 **{count} Freight Vehicle{'s' if count != 1 else ''} Impacted by Disruption{' on ' + corridor_code if corridor_code else ''}:**\n",
        "hi": f"🚛 **व्यवधान से {count} मालवाहक वाहन प्रभावित{' ' + corridor_code + ' पर' if corridor_code else ''}:**\n",
        "as": f"🚛 **বিঘিনিৰ ফলত {count} খন মালবাহী বাহন প্ৰভাৱিত{' ' + corridor_code + ' ত' if corridor_code else ''}:**\n",
        "bn": f"🚛 **বিঘ্নের কারণে {count} টি পণ্যবাহী গাড়ি প্রভাবিত{' ' + corridor_code + ' এ' if corridor_code else ''}:**\n",
        "ta": f"🚛 **{count} சரக்கு வாகனங்கள் பாதிக்கப்பட்டுள்ளன{' ' + corridor_code if corridor_code else ''}:**\n",
        "or": f"🚛 **ବ୍ୟାଘାତ ଯୋଗୁଁ {count} ଟି ମାଲବାହୀ ଯାନ ପ୍ରଭାବିତ{' ' + corridor_code if corridor_code else ''}:**\n"
    }

    lines = [headers.get(target_lang, headers["en"])]
    for v in vehicles[:5]:
        v_code = getattr(v, 'vehicle_code', None) or getattr(v, 'code', 'V-UNKNOWN')
        v_plate = getattr(v, 'registration', '')
        v_status = getattr(v, 'status', 'RESTRICTED')
        lines.append(f"• 🚛 **{v_code}** ({v_plate}) — `{v_status}`")

    return {
        "message": "\n".join(lines),
        "sources": ["VAHAN_TELEMETRY_STREAM", "DATABASE_VEHICLES"],
        "metrics": {"affected_vehicles_count": count},
        "recommendations": ["Authorize automated bypass reroute in Command Center", "Alert drivers via SMS broadcast"],
        "actions": [{"type": "NAVIGATE", "payload": {"route": "/routes"}}]
    }
