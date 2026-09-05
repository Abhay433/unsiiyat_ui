import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080';

  readonly scripts: ScriptOption[] = [
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', fontClass: 'font-urdu', dir: 'rtl' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', fontClass: 'font-hindi', dir: 'ltr' },
    { code: 'en', name: 'English', nativeName: 'English', fontClass: 'font-english', dir: 'ltr' }
  ];

  // Dynamic mapping loaded from DB table `scripts`
  private readonly scriptCodeToIdMap = new Map<ScriptCode, number>();
  private readonly scriptIdToCodeMap = new Map<number, ScriptCode>();

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
    this.syncScriptsFromBackend();
  }

  // Dynamically learn a script ID mapping
  learnScriptId(id?: number, code?: ScriptCode) {
    if (!id || !code) return;
    this.scriptIdToCodeMap.set(id, code);
    if (!this.scriptCodeToIdMap.has(code)) {
      this.scriptCodeToIdMap.set(code, id);
    }
  }

  // Load actual dynamic script IDs from the database
  syncScriptsFromBackend() {
    const parseScripts = (res: any) => {
      const list: any[] = Array.isArray(res)
        ? res
        : (res?.data?.content || res?.data?.data || res?.data || res?.content || []);
      if (!Array.isArray(list)) return;
      for (const s of list) {
        const code = (s.code || '').toLowerCase().trim();
        const name = (s.name || '').toLowerCase().trim();
        const id = Number(s.id);
        if (id) {
          if (code === 'ur' || name.includes('urdu') || name.includes('اردو') || name.includes('nastaliq')) {
            this.learnScriptId(id, 'ur');
          } else if (code === 'hi' || name.includes('hindi') || name.includes('हिन्दी') || name.includes('devanagari')) {
            this.learnScriptId(id, 'hi');
          } else if (code === 'en' || name.includes('english') || name.includes('roman') || name.includes('latin')) {
            this.learnScriptId(id, 'en');
          }
        }
      }
    };

    this.http.post<any>(`${this.baseUrl}/api/scripts/list`, { page: 0, size: 50 }).subscribe({
      next: parseScripts,
      error: () => {
        this.http.get<any>(`${this.baseUrl}/api/scripts`).subscribe({
          next: parseScripts,
          error: () => {}
        });
      }
    });
  }

  setScript(code: ScriptCode) {
    this.activeScript.set(code);
    localStorage.setItem('unsiiyat_script', code);
  }

  // Dynamic scriptId from database
  getScriptId(code: ScriptCode): number {
    if (this.scriptCodeToIdMap.has(code)) {
      return this.scriptCodeToIdMap.get(code)!;
    }
    switch (code) {
      case 'ur': return 1;
      case 'hi': return 9;
      case 'en': return 3;
      default: return 1;
    }
  }

  // Dynamic script code from database id
  getCodeFromId(id: number): ScriptCode {
    if (this.scriptIdToCodeMap.has(id)) {
      return this.scriptIdToCodeMap.get(id)!;
    }
    switch (id) {
      case 1:
      case 7:
      case 8:
        return 'ur';
      case 2:
      case 9:
        return 'hi';
      case 3:
      case 10:
        return 'en';
      default:
        return 'ur';
    }
  }

  // Universal language/script detection based on standard Unicode blocks
  detectScriptFromText(text?: string): ScriptCode {
    if (!text) return 'ur';
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari script (Hindi)
    if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'ur'; // Perso-Arabic (Urdu)
    if (/[a-zA-Z]/.test(text)) return 'en'; // Latin (English)
    return 'ur';
  }

  // Dynamic matching helper with automatic script-learning
  isScriptMatch(item?: { scriptId?: number; title?: string; body?: string } | null, targetCode?: ScriptCode): boolean {
    if (!item || !targetCode) return false;
    const sId = Number(item.scriptId);
    if (sId && this.scriptIdToCodeMap.has(sId)) {
      return this.scriptIdToCodeMap.get(sId) === targetCode;
    }
    const detected = this.detectScriptFromText((item.title || '') + ' ' + (item.body || ''));
    if (detected === targetCode) {
      if (sId) {
        this.learnScriptId(sId, detected);
      }
      return true;
    }
    if (sId && this.getCodeFromId(sId) === targetCode) {
      return true;
    }
    return false;
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
      'meaning_title': { ur: 'فرہنگ / لغت', hi: 'शब्दावली / लुग़त', en: 'Dictionary / Lughat' },
      'word_of_day': { ur: 'لفظِ روز', hi: 'आज का लफ़्ज़', en: 'Word of the Day' },
      'top_couplets': { ur: 'منتخب اشعار', hi: 'चयनित अशआर', en: 'Selected Couplets' },
      'audio_lounge': { ur: 'محفلِ سماعت', hi: 'महफ़िल-ए-समाअत', en: 'Audio Recitations' },
      'newsletter_title': { ur: 'روزانہ ایک شعر اپنے ان باکس میں حاصل کریں', hi: 'हर सुबह एक बेहतरीन शेर अपने इनबॉक्स में पाएं', en: 'Receive a Curated Couplet Every Day' },
      'subscribe': { ur: 'شامل ہوں', hi: 'सब्सक्राइब करें', en: 'Subscribe' },
      'subscribed_msg': { ur: 'شکریہ! آپ انسیت خاندان میں شامل ہو چکے ہیں۔', hi: 'शुक्रिया! आप उन्सीयत परिवार से जुड़ गए हैं।', en: 'Thank you! You are now subscribed to Unsiiyat.' }
    };

    return dictionary[key]?.[lang] || dictionary[key]?.['en'] || key;
  }
}
