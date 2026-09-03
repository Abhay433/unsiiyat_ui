import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { SeedDataService, ClassicalPoet, ClassicalPoem } from '../../core/services/seed-data.service';
import { DictionaryModalComponent } from '../../components/dictionary-modal/dictionary-modal.component';

export interface WordOfTheDay {
  word: string;
  pronunciation: string;
  origin: string;
  meanings: {
    ur: string;
    hi: string;
    en: string;
  };
  sampleCouplet: {
    firstLine: string;
    secondLine: string;
    poet: string;
  };
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, DictionaryModalComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly contentService = inject(ContentService);
  private readonly authorService = inject(AuthorService);
  private readonly taxonomyService = inject(TaxonomyService);
  readonly seedService = inject(SeedDataService);

  // Data signals
  poets = signal<any[]>([]);
  genres = signal<any[]>([]);
  themes = signal<any[]>([]);
  contents = signal<any[]>([]);
  loading = signal(true);

  // Feed Filter Tab
  activeFeedCategory = signal<'all' | 'ishq' | 'dard' | 'zindagi' | 'sufi' | 'inqilab'>('all');

  // Interactive states
  copiedHero = signal(false);
  copiedIndex = signal<number | null>(null);
  isPlayingAudio = signal(false);
  audioProgress = signal(0);
  heroFontSize = signal(28); // px
  likedItems = signal<Record<number, boolean>>({ 1: true });
  likeCounts = signal<Record<number, number>>({ 1: 342, 2: 218, 3: 189 });

  // Dictionary modal trigger
  showDictModal = signal(false);
  selectedDictWord = signal('');

  // Daily Words of the Day Database
  readonly wordsOfTheDay: WordOfTheDay[] = [
    {
      word: 'Unsiiyat (انسیت / उन्सीयत)',
      pronunciation: 'Un-see-yat',
      origin: 'Arabic (اُنسیت)',
      meanings: {
        ur: 'محبت، دلی لگاؤ، مانوسیت، باہمی قربت اور گہرا رشتہ',
        hi: 'आत्मीयता, लगाव, गहरा स्नेह, अपनत्व और प्रेम',
        en: 'Intimacy, profound affection, warmth, and close spiritual attachment'
      },
      sampleCouplet: {
        firstLine: 'کچھ اس ادا سے وہ ہم سے ہم کلام ہوئے',
        secondLine: 'کہ دل میں پھر سے وہی انسیت سی جاگ اٹھی',
        poet: 'منتخب کلام'
      }
    },
    {
      word: 'Khumaar (خمار / ख़ुमार)',
      pronunciation: 'Khoo-maar',
      origin: 'Arabic (خُمار)',
      meanings: {
        ur: 'نشہ کا اثر، سرمستی، مدہوشی، دھیمی مستی',
        hi: 'नशा, मदहोशी, प्रेम या सौंदर्य की मस्ती, हल्की खुमारी',
        en: 'Sweet intoxication, hangover of ecstasy, dreamy trance of love'
      },
      sampleCouplet: {
        firstLine: 'آنکھوں میں دمکتی ہے وہی پہلی ملاقات',
        secondLine: 'اب تک ہے ترے پیار کا اک ہلکا سا خمار',
        poet: 'احمد فراز'
      }
    },
    {
      word: 'Ranjish (رنجش / रंजिश)',
      pronunciation: 'Ran-jish',
      origin: 'Persian (رنجش)',
      meanings: {
        ur: 'خفگی، دلی صدمہ، ناراضگی، گلہ شکوہ',
        hi: 'मनमुटाव, ग़ुस्सा, उदासी, दिल की नाराज़गी',
        en: 'Estrangement, quiet resentment, sweet lovers quarrel or heartache'
      },
      sampleCouplet: {
        firstLine: 'رنجش ہی سہی دل ہی دکھانے کے لیے آ',
        secondLine: 'آ پھر سے مجھے چھوڑ کے جانے کے لیے آ',
        poet: 'احمد فراز'
      }
    },
    {
      word: 'Qaasid (قاصد / क़ासिद)',
      pronunciation: 'Qaa-sid',
      origin: 'Arabic (قاصد)',
      meanings: {
        ur: 'پیامبر، قاصد، خط یا محبت کا پیغام لے جانے والا',
        hi: 'संदेशवाहक, दूत, प्रेम का पैग़ाम पहुँचाने वाला',
        en: 'Messenger, courier carrying lovers secret letters and prayers'
      },
      sampleCouplet: {
        firstLine: 'قاصد کے آتے آتے خط اک اور لکھ رکھوں',
        secondLine: 'میں جانتا ہوں جو وہ لکھیں گے جواب میں',
        poet: 'مرزا غالب'
      }
    }
  ];

  activeWordIndex = signal(0);
  readonly currentWord = computed(() => this.wordsOfTheDay[this.activeWordIndex()]);

  // Featured Sher of the Day
  readonly heroCouplets: Record<ScriptCode, { firstLine: string; secondLine: string; poet: string; poemTitle: string; id: number; meaning: string }> = {
    ur: {
      firstLine: 'ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے',
      secondLine: 'بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے',
      poet: 'مرزا اسد اللہ خاں غالب',
      poemTitle: 'ہزاروں خواہشیں ایسی',
      id: 1,
      meaning: 'انسان کی آرزوئیں اور تمنائیں لامحدود ہیں، اگرچہ عمر بھر تمنائیں پوری ہوتی رہیں لیکن دل کی پیاس کبھی نہیں بجھتی۔'
    },
    hi: {
      firstLine: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले',
      secondLine: 'बहुत निकले मिरे अरमान लेकिन फिर भी कम निकले',
      poet: 'मिर्ज़ा ग़ालिब',
      poemTitle: 'हज़ारों ख़्वाहिशें ऐसी',
      id: 1,
      meaning: 'मनुष्य की इच्छाएं अनंत हैं, जीवन भर अनगिनत अरमान पूरे होने के बावजूद आत्मा की तृष्णा कभी ख़त्म नहीं होती।'
    },
    en: {
      firstLine: 'Hazaron khwahishen aisi ke har khwahish pe dam nikle',
      secondLine: 'Bahut nikle mire armaan lekin phir bhi kam nikle',
      poet: 'Mirza Ghalib',
      poemTitle: 'Hazaron Khwahishen Aisi',
      id: 1,
      meaning: 'Human desires are endless and boundless; even when thousands of longings are fulfilled, the soul remains yearning for more.'
    }
  };

  readonly currentHero = computed(() => {
    const lang = this.scriptService.activeScript();
    return this.heroCouplets[lang] || this.heroCouplets['ur'];
  });

  // Filtered feed contents
  readonly filteredContents = computed(() => {
    const all = this.contents();
    const cat = this.activeFeedCategory();
    if (cat === 'all') return all;

    const themeMap: Record<string, number> = {
      ishq: 1,
      dard: 2,
      zindagi: 4,
      sufi: 5,
      inqilab: 7
    };

    const targetThemeId = themeMap[cat];
    if (!targetThemeId) return all;

    return all.filter(item => item.themeIds?.includes(targetThemeId));
  });

  constructor() {
    // Re-evaluate localized text on script changes
    effect(() => {
      this.scriptService.activeScript();
      this.loadData();
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    // Load authors
    this.authorService.getEnrichedAuthors(scriptId).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.poets.set(data);
        } else {
          this.setFallbackPoets();
        }
      },
      error: () => this.setFallbackPoets()
    });

    // Load contents
    this.contentService.getEnrichedContents(scriptId).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.contents.set(data);
        } else {
          this.setFallbackContents();
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallbackContents();
        this.loading.set(false);
      }
    });

    // Load genres & themes
    this.taxonomyService.filterGenres().subscribe({
      next: (res) => {
        this.genres.set(res.data?.length ? res.data : this.seedService.initialGenres);
      },
      error: () => this.genres.set(this.seedService.initialGenres)
    });

    this.taxonomyService.filterThemes().subscribe({
      next: (res) => {
        this.themes.set(res.data?.length ? res.data : this.seedService.initialThemes);
      },
      error: () => this.themes.set(this.seedService.initialThemes)
    });
  }

  private setFallbackPoets() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoets.map(p => ({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: p.avatarUrl,
      primaryName: p.details[lang]?.name || p.details.ur.name,
      primaryBio: p.details[lang]?.biography || p.details.ur.biography
    }));
    this.poets.set(list);
  }

  private setFallbackContents() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoems.map(poem => {
      const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);
      const text = poem.texts[lang] || poem.texts.ur;
      return {
        id: poem.id,
        title: poem.title,
        genreId: poem.genreId,
        authorId: poem.authorId,
        authorName: poet?.details[lang]?.name || 'Legendary Poet',
        primaryText: {
          title: text.title,
          body: text.body
        },
        themeIds: poem.themeIds
      };
    });
    this.contents.set(list);
  }

  copyHeroCouplet() {
    const hero = this.currentHero();
    const text = `${hero.firstLine}\n${hero.secondLine}\n\n— ${hero.poet}\n(Via Unsiiyat Poetry - Rekhta Realm)`;
    navigator.clipboard.writeText(text);
    this.copiedHero.set(true);
    setTimeout(() => this.copiedHero.set(false), 2200);
  }

  copyFeedCouplet(index: number, lines: string[], author: string) {
    const text = `${lines.join('\n')}\n\n— ${author}\n(Via Unsiiyat Poetry)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  toggleAudio() {
    this.isPlayingAudio.update(v => !v);
    if (this.isPlayingAudio()) {
      this.audioProgress.set(10);
      const interval = setInterval(() => {
        if (!this.isPlayingAudio()) {
          clearInterval(interval);
          return;
        }
        this.audioProgress.update(p => {
          if (p >= 100) {
            this.isPlayingAudio.set(false);
            clearInterval(interval);
            return 0;
          }
          return p + 15;
        });
      }, 1000);
    } else {
      this.audioProgress.set(0);
    }
  }

  toggleLike(id: number) {
    this.likedItems.update(map => {
      const current = !!map[id];
      const next = !current;
      return { ...map, [id]: next };
    });

    this.likeCounts.update(map => {
      const isLiked = this.likedItems()[id];
      const count = (map[id] || 150) + (isLiked ? 1 : -1);
      return { ...map, [id]: count };
    });
  }

  nextWord() {
    this.activeWordIndex.update(idx => (idx + 1) % this.wordsOfTheDay.length);
  }

  prevWord() {
    this.activeWordIndex.update(idx => (idx - 1 + this.wordsOfTheDay.length) % this.wordsOfTheDay.length);
  }

  openDictionaryWith(word: string) {
    this.selectedDictWord.set(word);
    this.showDictModal.set(true);
  }

  changeFontSize(delta: number) {
    const newSize = this.heroFontSize() + delta;
    if (newSize >= 18 && newSize <= 42) {
      this.heroFontSize.set(newSize);
    }
  }

  getFirstCouplet(body?: string): string[] {
    if (!body) return ['', ''];
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return [lines[0] || '', lines[1] || ''];
  }
}
