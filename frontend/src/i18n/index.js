import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import as from './locales/as.json';
import bn from './locales/bn.json';
import mni from './locales/mni.json';
import kha from './locales/kha.json';
import lus from './locales/lus.json';
import ne from './locales/ne.json';
import brx from './locales/brx.json';
import grt from './locales/grt.json';
import or from './locales/or.json';
import ta from './locales/ta.json';

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'National / Baseline' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'National' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', region: 'Assam' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'Tripura / Barak' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', region: 'Bodoland' },
  { code: 'mni', name: 'Manipuri / Meitei', nativeName: 'মৈতৈলোন্', region: 'Manipur' },
  { code: 'lus', name: 'Mizo', nativeName: 'Mizo', region: 'Mizoram' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', region: 'Sikkim' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', region: 'Odisha / Regional' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'National / Southern' },
  { code: 'kha', name: 'Khasi', nativeName: 'Khasi', region: 'Meghalaya' },
  { code: 'grt', name: 'Garo', nativeName: 'A·chik', region: 'Garo Hills' }
];

const savedLang = (() => {
  try {
    const l = localStorage.getItem('ner88_language') || localStorage.getItem('linkx8_language') || localStorage.getItem('link_x8_lang') || localStorage.getItem('ner_logiai_lang');
    if (l && supportedLanguages.some(s => s.code === l)) {
      return l;
    }
  } catch {
    // Ignore localStorage access errors
  }
  return 'en';
})();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      as: { translation: as },
      bn: { translation: bn },
      mni: { translation: mni },
      kha: { translation: kha },
      lus: { translation: lus },
      ne: { translation: ne },
      brx: { translation: brx },
      grt: { translation: grt },
      or: { translation: or },
      ta: { translation: ta }
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false
    }
  });

export const setAppLanguage = (langCode) => {
  if (supportedLanguages.some(s => s.code === langCode)) {
    i18n.changeLanguage(langCode);
    try {
      localStorage.setItem('ner88_language', langCode);
      localStorage.setItem('linkx8_language', langCode);
      localStorage.setItem('link_x8_lang', langCode);
      localStorage.setItem('ner_logiai_lang', langCode);
    } catch {
      // Ignore storage errors
    }
    window.dispatchEvent(new CustomEvent('ner88_lang_changed', { detail: langCode }));
    window.dispatchEvent(new CustomEvent('linkx8_lang_changed', { detail: langCode }));
  }
};

export default i18n;

