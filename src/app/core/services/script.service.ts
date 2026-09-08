import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export type ScriptCode = 'ur' | 'hi' | 'en';

export interface ScriptOption {
  id?: number;
  code: ScriptCode;
  name: string;
  nativeName: string;
  fontClass: string;
  dir: 'rtl' | 'ltr';
}

const DEFAULT_SCRIPTS: ScriptOption[] = [
  { id: 1, code: 'ur', name: 'Urdu', nativeName: 'اردو', fontClass: 'font-urdu', dir: 'rtl' },
  { id: 2, code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', fontClass: 'font-hindi', dir: 'ltr' },
  { id: 3, code: 'en', name: 'English', nativeName: 'English', fontClass: 'font-english', dir: 'ltr' }
];

@Injectable({
  providedIn: 'root'
})
export class ScriptService {
  private readonly api = inject(ApiService);

  // Dynamic scripts loaded directly from backend `/api/scripts/list`
  readonly scripts = signal<ScriptOption[]>(DEFAULT_SCRIPTS);

  // Dynamic mapping loaded from DB table `scripts`
  private readonly scriptCodeToIdMap = new Map<string, number>();
  private readonly scriptIdToCodeMap = new Map<number, ScriptCode>();

  // Active script signal (defaults to Urdu)
  readonly activeScript = signal<ScriptCode>('ur');
  readonly activeScriptId = signal<number>(1);
  readonly scriptSyncVersion = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);

  readonly currentScriptOption = computed(() => {
    return this.scripts().find(s => s.code === this.activeScript()) || this.scripts()[0];
  });

  readonly isRtl = computed(() => this.currentScriptOption().dir === 'rtl');
  readonly fontClass = computed(() => this.currentScriptOption().fontClass);

  constructor() {
    const saved = localStorage.getItem('unsiiyat_script') as ScriptCode;
    if (saved && (saved === 'ur' || saved === 'hi' || saved === 'en')) {
      this.activeScript.set(saved);
    }
    const savedId = Number(localStorage.getItem('unsiiyat_script_id'));
    if (savedId && !isNaN(savedId)) {
      this.activeScriptId.set(savedId);
    }
    this.syncScriptsFromBackend().subscribe();
  }

  // Dynamically learn a script ID mapping
  learnScriptId(id?: number, code?: ScriptCode) {
    if (!id || !code) return;
    this.scriptIdToCodeMap.set(id, code);
    if (!this.scriptCodeToIdMap.has(code)) {
      this.scriptCodeToIdMap.set(code, id);
    }
  }

  // Load actual dynamic script IDs from the database `/api/scripts/list`
  syncScriptsFromBackend(): Observable<ScriptOption[]> {
    this.isSyncing.set(true);
    const payload = { page: 0, size: 50, sortBy: 'id', sortDirection: 'asc' };

    return this.api.post<any>('/api/scripts/list', payload).pipe(
      map(res => this.handleScriptsResponse(res)),
      catchError(err => {
        return this.api.get<any>('/api/scripts').pipe(
          map(res => this.handleScriptsResponse(res)),
          catchError(() => {
            return this.api.get<any>('/api/scripts/list').pipe(
              map(res => this.handleScriptsResponse(res)),
              catchError(() => {
                this.isSyncing.set(false);
                return of(this.scripts());
              })
            );
          })
        );
      })
    );
  }

  handleScriptsResponse(res: any): ScriptOption[] {
    this.isSyncing.set(false);
    let list: any[] = [];
    if (Array.isArray(res)) {
      list = res;
    } else if (res && typeof res === 'object') {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && Array.isArray(res.data.content)) {
        list = res.data.content;
      } else if (res.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.content)) {
        list = res.content;
      }
    }

    if (!Array.isArray(list) || list.length === 0) {
      return this.scripts();
    }

    return this.syncWithScriptList(list);
  }

  syncWithScriptList(list: any[]): ScriptOption[] {
    if (!Array.isArray(list) || list.length === 0) {
      return this.scripts();
    }

    const newOptions: ScriptOption[] = [];
    const seenCodes = new Set<string>();

    for (const s of list) {
      const id = Number(s.id);
      const rawCode = (s.code || '').toString().trim().toLowerCase();
      const rawName = (s.name || '').toString().trim();
      const lowerName = rawName.toLowerCase();

      let code: ScriptCode = 'ur';
      let name = rawName || 'Urdu';
      let nativeName = s.nativeName || 'اردو';
      let fontClass = 'font-urdu';
      let dir: 'rtl' | 'ltr' = 'rtl';

      if (
        rawCode === 'hi' ||
        rawCode === 'hin' ||
        rawCode === 'hindi' ||
        lowerName.includes('hindi') ||
        lowerName.includes('हिन्दी') ||
        lowerName.includes('devanagari')
      ) {
        code = 'hi';
        name = rawName || 'Hindi';
        nativeName = s.nativeName || 'हिन्दी';
        fontClass = 'font-hindi';
        dir = 'ltr';
      } else if (
        rawCode === 'en' ||
        rawCode === 'eng' ||
        rawCode === 'english' ||
        lowerName.includes('english') ||
        lowerName.includes('roman') ||
        lowerName.includes('latin')
      ) {
        code = 'en';
        name = rawName || 'English';
        nativeName = s.nativeName || 'English';
        fontClass = 'font-english';
        dir = 'ltr';
      } else if (
        rawCode === 'ur' ||
        rawCode === 'urd' ||
        rawCode === 'urdu' ||
        lowerName.includes('urdu') ||
        lowerName.includes('اردو') ||
        lowerName.includes('nastaliq')
      ) {
        code = 'ur';
        name = rawName || 'Urdu';
        nativeName = s.nativeName || 'اردو';
        fontClass = 'font-urdu';
        dir = 'rtl';
      } else {
        code = (rawCode as ScriptCode) || 'ur';
        name = rawName || code;
        nativeName = s.nativeName || name;
        fontClass = 'font-sans';
        dir = 'ltr';
      }

      if (id && !isNaN(id)) {
        this.scriptCodeToIdMap.set(code, id);
        this.scriptIdToCodeMap.set(id, code);
      }

      newOptions.push({
        id: id && !isNaN(id) ? id : undefined,
        code,
        name,
        nativeName,
        fontClass,
        dir
      });
      seenCodes.add(code);
    }

    // Ensure standard scripts (ur, hi, en) exist even if backend only returned a subset
    const standardDefaults: ScriptOption[] = [
      { id: 1, code: 'ur', name: 'Urdu', nativeName: 'اردو', fontClass: 'font-urdu', dir: 'rtl' },
      { id: 2, code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', fontClass: 'font-hindi', dir: 'ltr' },
      { id: 3, code: 'en', name: 'English', nativeName: 'English', fontClass: 'font-english', dir: 'ltr' }
    ];

    for (const def of standardDefaults) {
      if (!seenCodes.has(def.code)) {
        const id = this.scriptCodeToIdMap.get(def.code) || def.id;
        newOptions.push({ ...def, id });
        if (id) {
          this.scriptCodeToIdMap.set(def.code, id);
          this.scriptIdToCodeMap.set(id, def.code);
        }
      }
    }

    // Standard ordering: Urdu, Hindi, English, then others
    const orderPriority: Record<string, number> = { 'ur': 1, 'hi': 2, 'en': 3 };
    newOptions.sort((a, b) => {
      const pA = orderPriority[a.code] || 99;
      const pB = orderPriority[b.code] || 99;
      return pA - pB;
    });

    this.scripts.set(newOptions);

    // Update activeScriptId to match currently selected script
    const currentCode = this.activeScript();
    const matched = newOptions.find(o => o.code === currentCode);
    if (matched?.id) {
      this.activeScriptId.set(matched.id);
      localStorage.setItem('unsiiyat_script_id', String(matched.id));
    }

    this.scriptSyncVersion.update(v => v + 1);
    return newOptions;
  }

  setScript(code: ScriptCode) {
    this.activeScript.set(code);
    localStorage.setItem('unsiiyat_script', code);
    const matched = this.scripts().find(s => s.code === code);
    if (matched?.id) {
      this.activeScriptId.set(matched.id);
      this.scriptCodeToIdMap.set(code, matched.id);
      this.scriptIdToCodeMap.set(matched.id, code);
      localStorage.setItem('unsiiyat_script_id', String(matched.id));
    }
  }

  selectScript(option: ScriptOption) {
    this.activeScript.set(option.code);
    localStorage.setItem('unsiiyat_script', option.code);
    if (option.id) {
      this.activeScriptId.set(option.id);
      this.scriptCodeToIdMap.set(option.code, option.id);
      this.scriptIdToCodeMap.set(option.id, option.code);
      localStorage.setItem('unsiiyat_script_id', String(option.id));
    }
  }

  setScriptById(id: number) {
    const code = this.getCodeFromId(id);
    this.activeScript.set(code);
    this.activeScriptId.set(id);
    localStorage.setItem('unsiiyat_script', code);
    localStorage.setItem('unsiiyat_script_id', String(id));
  }

  // Dynamic scriptId from database
  getScriptId(code?: ScriptCode): number {
    const target = code || this.activeScript();
    if (this.scriptCodeToIdMap.has(target)) {
      return this.scriptCodeToIdMap.get(target)!;
    }
    const found = this.scripts().find(s => s.code === target);
    if (found?.id) {
      this.scriptCodeToIdMap.set(target, found.id);
      return found.id;
    }
    switch (target) {
      case 'ur': return 1;
      case 'hi': return 2;
      case 'en': return 3;
      default: return 1;
    }
  }

  // Dynamic script code from database id
  getCodeFromId(id: number): ScriptCode {
    if (this.scriptIdToCodeMap.has(id)) {
      return this.scriptIdToCodeMap.get(id)!;
    }
    const found = this.scripts().find(s => s.id === id);
    if (found?.code) {
      this.scriptIdToCodeMap.set(id, found.code);
      return found.code;
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
      'poets': { ur: 'شعراء', hi: 'शायर / रचनाकार', en: 'Authors' },
      'ghazals': { ur: 'غزلیات', hi: 'ग़ज़लें', en: 'Ghazals' },
      'nazms': { ur: 'نظمیں', hi: 'نज़्में', en: 'Nazms' },
      'shers': { ur: 'اشعار', hi: 'अशआर', en: 'Couplets' },
      'themes': { ur: 'موضوعات', hi: 'मौज़ूआत', en: 'Themes' },
      'genres': { ur: 'اصناف', hi: 'विधाएं', en: 'Genres' },
      'sher_of_day': { ur: 'شعرِ امروز', hi: 'आज का शेर', en: 'Couplet of the Day' },
      'ghazal_of_day': { ur: 'غزلِ روز', hi: 'आज की ग़ज़ل', en: 'Ghazal of the Day' },
      'selected_ghazals': { ur: 'منتخب غزلیات', hi: 'चुनिंदा ग़ज़लें', en: 'Selected Ghazals' },
      'selected_ghazal': { ur: 'منتخب غزل', hi: 'चुनिंदा ग़ज़ल', en: 'Selected Ghazal' },
      'all_ghazals': { ur: 'تمام غزلیں', hi: 'सभी ग़ज़लें', en: 'All Ghazals' },
      'selected_nazms': { ur: 'منتخب نظمیں', hi: 'चुनिंदा नज़्में', en: 'Selected Nazms' },
      'selected_nazm': { ur: 'منتخب نظم', hi: 'चुनिंदा नज़्म', en: 'Selected Nazm' },
      'all_nazms': { ur: 'تمام نظمیں', hi: 'सभी नज़्में', en: 'All Nazms' },
      'explore_poets': { ur: 'مشہور شعراء', hi: 'मशहूर रचनाकार', en: 'Explore Authors' },
      'explore_genres': { ur: 'شاعری کی اصناف', hi: 'شायरी की विधाएं', en: 'Explore Genres' },
      'explore_themes': { ur: 'موضوعات اور جذبات', hi: 'जज़्बात और अहसास', en: 'Moods & Themes' },
      'recent_ghazals': { ur: 'تازہ کلام', hi: 'ताज़ा कलाम', en: 'Recent Couplets & Ghazals' },
      'search_placeholder': { ur: 'مصنف، شاعر، غزل، یا کوئی شعر تلاش کریں...', hi: 'रचनाकार, ग़ज़ल या कोई शेर खोजें...', en: 'Search author, ghazal or couplet...' },
      'read_more': { ur: 'مکمل کلام پڑھیں', hi: 'मुकम्मल कलाम पढ़ें', en: 'Read Full Poem' },
      'copy_sher': { ur: 'شعر کاپی کریں', hi: 'शेर कॉपी करें', en: 'Copy Couplet' },
      'copied': { ur: 'کاپی ہو گیا!', hi: 'कॉपी हो गया!', en: 'Copied!' },
      'studio': { ur: 'انسیت اسٹوڈیو', hi: 'उन्सीयत स्टूडियो', en: 'Studio / Admin' },
      'login': { ur: 'داخل ہوں', hi: 'लॉग इन', en: 'Login' },
      'register': { ur: 'رجسٹریشن', hi: 'रजिस्टर', en: 'Register' },
      'logout': { ur: 'لاگ آؤٹ', hi: 'लॉग आउट', en: 'Logout' },
      'all_poets': { ur: 'تمام شعراء', hi: 'सभी रचनाकार', en: 'All Authors' },
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
