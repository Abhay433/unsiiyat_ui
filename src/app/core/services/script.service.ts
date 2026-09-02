import { Injectable, signal, computed } from '@angular/core';

export type ScriptCode = 'ur' | 'hi' | 'en';

export interface ScriptOption {
  code: ScriptCode;
  name: string;
  nativeName: string;
  fontClass: string;
  dir: 'rtl' | 'ltr';
}

@Injectable({
  providedIn: 'root'
})
export class ScriptService {
  readonly scripts: ScriptOption[] = [
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', fontClass: 'font-urdu', dir: 'rtl' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', fontClass: 'font-hindi', dir: 'ltr' },
    { code: 'en', name: 'English', nativeName: 'English', fontClass: 'font-english', dir: 'ltr' }
  ];

  // Active script signal (defaults to Urdu)
  readonly activeScript = signal<ScriptCode>('ur');

  readonly currentScriptOption = computed(() => {
    return this.scripts.find(s => s.code === this.activeScript()) || this.scripts[0];
  });

  readonly isRtl = computed(() => this.currentScriptOption().dir === 'rtl');
  readonly fontClass = computed(() => this.currentScriptOption().fontClass);

  constructor() {
    const saved = localStorage.getItem('unsiiyat_script') as ScriptCode;
    if (saved && (saved === 'ur' || saved === 'hi' || saved === 'en')) {
      this.activeScript.set(saved);
    }
  }

  setScript(code: ScriptCode) {
    this.activeScript.set(code);
    localStorage.setItem('unsiiyat_script', code);
  }

  // Get scriptId based on standard mapping (1 = Urdu, 2 = Hindi, 3 = English or dynamic)
  getScriptId(code: ScriptCode): number {
    switch (code) {
      case 'ur': return 1;
      case 'hi': return 2;
      case 'en': return 3;
      default: return 1;
    }
  }

  getCodeFromId(id: number): ScriptCode {
    switch (id) {
      case 1: return 'ur';
      case 2: return 'hi';
      case 3: return 'en';
      default: return 'ur';
    }
  }

  // UI translations dictionary
  translate(key: string): string {
    const lang = this.activeScript();
    const dictionary: Record<string, Record<ScriptCode, string>> = {
      'brand': { ur: 'انسیت', hi: 'उन्सीयत', en: 'Unsiiyat' },
      'tagline': { ur: 'اردو اور ہندی شاعری کا دلکش گلستان', hi: 'उर्दू और हिन्दी शायरी का रूहानी गुलिस्ताँ', en: 'The Timeless World of Urdu & Hindi Poetry' },
      'poets': { ur: 'شعراء', hi: 'शायर', en: 'Poets' },
      'ghazals': { ur: 'غزلیات', hi: 'ग़ज़लें', en: 'Ghazals' },
      'nazms': { ur: 'نظمیں', hi: 'नज़्में', en: 'Nazms' },
      'shers': { ur: 'اشعار', hi: 'अशआर', en: 'Couplets' },
      'themes': { ur: 'موضوعات', hi: 'मौज़ूआत', en: 'Themes' },
      'genres': { ur: 'اصناف', hi: 'विधाएं', en: 'Genres' },
      'sher_of_day': { ur: 'شعرِ امروز', hi: 'आज का शेर', en: 'Couplet of the Day' },
      'explore_poets': { ur: 'مشہور شعراء', hi: 'मशहूर शायर', en: 'Legendary Poets' },
      'explore_genres': { ur: 'شاعری کی اصناف', hi: 'शायरी की विधाएं', en: 'Explore Genres' },
      'explore_themes': { ur: 'موضوعات اور جذبات', hi: 'जज़्बात और अहसास', en: 'Moods & Themes' },
      'recent_ghazals': { ur: 'تازہ کلام', hi: 'ताज़ा कलाम', en: 'Recent Couplets & Ghazals' },
      'search_placeholder': { ur: 'شاعر، غزل، یا کوئی شعر تلاش کریں...', hi: 'शायर, ग़ज़ल या कोई शेर खोजें...', en: 'Search poet, ghazal or couplet...' },
      'read_more': { ur: 'مکمل کلام پڑھیں', hi: 'मुकम्मल कलाम पढ़ें', en: 'Read Full Poem' },
      'copy_sher': { ur: 'شعر کاپی کریں', hi: 'शेर कॉपी करें', en: 'Copy Couplet' },
      'copied': { ur: 'کاپی ہو گیا!', hi: 'कॉपी हो गया!', en: 'Copied!' },
      'studio': { ur: 'انسیت اسٹوڈیو', hi: 'उन्सीयत स्टूडियो', en: 'Studio / Admin' },
      'login': { ur: 'داخل ہوں', hi: 'लॉग इन', en: 'Login' },
      'register': { ur: 'رجسٹریشن', hi: 'रजिस्टर', en: 'Register' },
      'logout': { ur: 'لاگ آؤٹ', hi: 'लॉग आउट', en: 'Logout' },
      'all_poets': { ur: 'تمام شعراء', hi: 'सभी शायर', en: 'All Poets' },
      'born': { ur: 'پیدائش', hi: 'पैदाइश', en: 'Born' },
      'died': { ur: 'وفات', hi: 'विसाल / देहांत', en: 'Died' },
      'font_size': { ur: 'حجمِ خط', hi: 'फ़ॉन्ट साइज़', en: 'Font Size' },
      'meaning_title': { ur: 'فرہنگ / لغت', hi: 'शब्दावली / लुग़त', en: 'Word Meaning / Dictionary' }
    };

    return dictionary[key]?.[lang] || dictionary[key]?.['en'] || key;
  }
}
