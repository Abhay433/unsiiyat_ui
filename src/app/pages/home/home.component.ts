import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { SeedDataService, ClassicalPoet, ClassicalPoem } from '../../core/services/seed-data.service';
import { DictionaryModalComponent } from '../../components/dictionary-modal/dictionary-modal.component';
import { GenreCuratedGroup, Content } from '../../core/models/content.models';

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

export interface HeroCouplet {
  id: number;
  firstLine: string;
  secondLine: string;
  poet: string;
  poetAvatar?: string;
  poemTitle: string;
  meaning: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DictionaryModalComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly contentService = inject(ContentService);
  readonly authorService = inject(AuthorService);
  private readonly taxonomyService = inject(TaxonomyService);
  readonly seedService = inject(SeedDataService);

  getPoetAvatar(poet: any): string {
    return this.authorService.getAuthorAvatar(poet);
  }

  onImgError(event: Event, poet: any) {
    const target = event.target as HTMLImageElement;
    if (target) {
      const name = poet?.primaryName || poet?.name || 'Poet';
      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d2216&color=d4af37&font-size=0.38&bold=true`;
    }
  }

  // Data signals
  poets = signal<any[]>([]);
  carouselAuthors = signal<any[]>([]);
  authorCarouselPage = signal<number>(0);
  authorCarouselTotalPages = signal<number>(1);
  authorCarouselTotalElements = signal<number>(0);
  authorCarouselLoading = signal<boolean>(false);
  authorCarouselIsLast = signal<boolean>(false);

  genres = signal<any[]>([]);
  themes = signal<any[]>([]);

  // Selected Ghazals Carousel Section (Between Explore Authors and Word of the Day)
  selectedGhazals = signal<Content[]>([]);
  selectedGhazalIndex = signal<number>(0);
  selectedGhazalLoading = signal<boolean>(false);
  selectedGhazalFontSize = signal<number>(28);
  copiedSelectedGhazal = signal<boolean>(false);
  readonly selectedGhazalsLimit = 8; // Handled from UI (top 8 selected ghazals)

  readonly currentSelectedGhazal = computed(() => {
    const list = this.selectedGhazals();
    if (list.length === 0) return null;
    const idx = this.selectedGhazalIndex();
    return list[idx] || list[0];
  });

  // Selected Nazms Carousel Section
  selectedNazms = signal<Content[]>([]);
  selectedNazmIndex = signal<number>(0);
  selectedNazmLoading = signal<boolean>(false);
  selectedNazmFontSize = signal<number>(28);
  copiedSelectedNazm = signal<boolean>(false);

  readonly currentSelectedNazm = computed(() => {
    const list = this.selectedNazms();
    if (list.length === 0) return null;
    const idx = this.selectedNazmIndex();
    return list[idx] || list[0];
  });
  contents = signal<any[]>([]);
  ghazalOfTheDay = signal<any>(null);
  loading = signal(true);

  // --- Combined Multi-Filter & Search Signals (Part B) ---
  searchKeyword = signal<string>('');
  selectedAuthorId = signal<number | 'all'>('all');
  selectedGenreId = signal<number | 'all'>('all');
  selectedThemeId = signal<number | 'all'>('all');
  sortBy = signal<'trending' | 'popular' | 'newest' | 'title'>('trending');
  activeFeedCategory = signal<'all' | 'ishq' | 'dard' | 'zindagi' | 'sufi' | 'inqilab'>('all');

  // Interactive UI states
  copiedHero = signal(false);
  copiedIndex = signal<number | null>(null);
  isPlayingAudio = signal(false);
  audioProgress = signal(0);
  heroFontSize = signal(28); // px

  // Simulated engagement metrics for trending & popular sorting
  viewCounts = signal<Record<number, number>>({ 1: 14200, 2: 9800, 3: 8400, 4: 6100, 5: 5500 });
  likedItems = signal<Record<number, boolean>>({ 1: true });
  likeCounts = signal<Record<number, number>>({ 1: 342, 2: 218, 3: 189, 4: 154, 5: 128 });

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
  readonly heroCouplets: Record<ScriptCode, HeroCouplet> = {
    ur: {
      firstLine: 'ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے',
      secondLine: 'بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے',
      poet: 'مرزا اسد اللہ خاں غالب',
      poetAvatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100',
      poemTitle: 'ہزاروں خواہشیں ایسی',
      id: 1,
      meaning: 'انسان کی آرزوئیں اور تمنائیں لامحدود ہیں، اگرچہ عمر بھر تمنائیں پوری ہوتی رہیں لیکن دل کی پیاس کبھی نہیں بجھتی۔'
    },
    hi: {
      firstLine: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले',
      secondLine: 'बहुत निकले मिरे अरमान लेकिन फिर भी कम निकले',
      poet: 'मिर्ज़ा ग़ालिब',
      poetAvatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100',
      poemTitle: 'हज़ारों ख़्वाहिशें ऐसी',
      id: 1,
      meaning: 'मनुष्य की इच्छाएं अनंत हैं, जीवन भर अनगिनत अरमान पूरे होने के बावजूद आत्मा की तृष्णा कभी ख़त्म नहीं होती।'
    },
    en: {
      firstLine: 'Hazaron khwahishen aisi ke har khwahish pe dam nikle',
      secondLine: 'Bahut nikle mire armaan lekin phir bhi kam nikle',
      poet: 'Mirza Ghalib',
      poetAvatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100',
      poemTitle: 'Hazaron Khwahishen Aisi',
      id: 1,
      meaning: 'Human desires are endless and boundless; even when thousands of longings are fulfilled, the soul remains yearning for more.'
    }
  };

  readonly currentHero = computed(() => {
    const ghazal = this.ghazalOfTheDay();
    const lang = this.scriptService.activeScript();
    if (ghazal && (ghazal.primaryText?.body?.trim() || ghazal.title?.trim())) {
      const body = ghazal.primaryText?.body || '';
      const lines = body.split(String.fromCharCode(10)).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const firstLine = lines.length > 0 ? lines[0] : (ghazal.title || 'Ghazal of the Day');
      const secondLine = lines.length > 1 ? lines[1] : '';
      const poet = ghazal.author?.primaryName || ghazal.author?.name || 'Classical Shayar';
      const poetAvatar = this.authorService.getAuthorAvatar(ghazal.author);
      return {
        id: ghazal.id,
        firstLine,
        secondLine,
        poet,
        poetAvatar,
        poemTitle: ghazal.title || 'Ghazal of the Day',
        meaning: ''
      };
    }
    return this.heroCouplets[lang] || this.heroCouplets['ur'];
  });

  // Active Filter Helpers
  readonly hasActiveFilters = computed(() => {
    return (
      this.searchKeyword().trim() !== '' ||
      this.selectedAuthorId() !== 'all' ||
      this.selectedGenreId() !== 'all' ||
      this.selectedThemeId() !== 'all' ||
      this.activeFeedCategory() !== 'all'
    );
  });

  readonly activeFiltersCount = computed(() => {
    let count = 0;
    if (this.searchKeyword().trim() !== '') count++;
    if (this.selectedAuthorId() !== 'all') count++;
    if (this.selectedGenreId() !== 'all') count++;
    if (this.selectedThemeId() !== 'all') count++;
    if (this.activeFeedCategory() !== 'all') count++;
    return count;
  });

  readonly selectedAuthorName = computed(() => {
    const id = this.selectedAuthorId();
    if (id === 'all') return null;
    const poet = this.poets().find(p => p.id === Number(id));
    return poet?.primaryName || 'Selected Poet';
  });

  readonly selectedGenreName = computed(() => {
    const id = this.selectedGenreId();
    if (id === 'all') return null;
    const g = this.genres().find(genre => genre.id === Number(id));
    return g?.name || 'Selected Genre';
  });

  readonly selectedThemeName = computed(() => {
    const id = this.selectedThemeId();
    if (id === 'all') return null;
    const t = this.themes().find(theme => theme.id === Number(id));
    return t?.name || 'Selected Theme';
  });

  // Filtered & Sorted Feed Contents (Combined Multi-Filter Engine)
  readonly filteredContents = computed(() => {
    let list = [...this.contents()];

    // 1. Keyword search (title, couplet lines, poet name)
    const q = this.searchKeyword().toLowerCase().trim();
    if (q) {
      list = list.filter(item => {
        const titleMatch = (item.title || '').toLowerCase().includes(q) || (item.primaryText?.title || '').toLowerCase().includes(q);
        const bodyMatch = (item.primaryText?.body || '').toLowerCase().includes(q);
        const authorMatch = (item.author?.primaryName || item.authorName || '').toLowerCase().includes(q);
        return titleMatch || bodyMatch || authorMatch;
      });
    }

    // 2. Author Filter
    const authorId = this.selectedAuthorId();
    if (authorId !== 'all') {
      list = list.filter(item => item.authorId === Number(authorId));
    }

    // 3. Genre Filter
    const genreId = this.selectedGenreId();
    if (genreId !== 'all') {
      list = list.filter(item => item.genreId === Number(genreId));
    }

    // 4. Theme Filter (Dropdown)
    const themeId = this.selectedThemeId();
    if (themeId !== 'all') {
      list = list.filter(item => item.themeIds?.includes(Number(themeId)));
    }

    // 5. Quick Category Filter Tab
    const cat = this.activeFeedCategory();
    if (cat !== 'all') {
      const themeMap: Record<string, number> = {
        ishq: 1,
        dard: 2,
        zindagi: 4,
        sufi: 5,
        inqilab: 7
      };
      const targetThemeId = themeMap[cat];
      if (targetThemeId) {
        list = list.filter(item => item.themeIds?.includes(targetThemeId));
      }
    }

    // 6. Sorting Engine (Trending, Popular, Newest, Title)
    const sort = this.sortBy();
    if (sort === 'trending') {
      list.sort((a, b) => (this.likeCounts()[b.id] || 100) - (this.likeCounts()[a.id] || 100));
    } else if (sort === 'popular') {
      list.sort((a, b) => (this.viewCounts()[b.id] || 5000) - (this.viewCounts()[a.id] || 5000));
    } else if (sort === 'newest') {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (sort === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return list;
  });

  // Filter Reset & Quick Filter Actions
  resetAllFilters() {
    this.searchKeyword.set('');
    this.selectedAuthorId.set('all');
    this.selectedGenreId.set('all');
    this.selectedThemeId.set('all');
    this.activeFeedCategory.set('all');
  }

  clearSearch() {
    this.searchKeyword.set('');
  }

  clearAuthor() {
    this.selectedAuthorId.set('all');
  }

  clearGenre() {
    this.selectedGenreId.set('all');
  }

  clearTheme() {
    this.selectedThemeId.set('all');
  }

  clearFeedCategory() {
    this.activeFeedCategory.set('all');
  }

  setFeedCategory(cat: 'all' | 'ishq' | 'dard' | 'zindagi' | 'sufi' | 'inqilab') {
    this.activeFeedCategory.set(cat);
  }

  getViewCount(id?: number): number {
    return (id && this.viewCounts()[id]) ? this.viewCounts()[id] : 4200;
  }

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

  loadGhazalOfTheDay(scriptId?: number) {
    this.contentService.getGhazalOfTheDay(scriptId).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.ghazalOfTheDay.set(res.data);
        }
      },
      error: () => {}
    });
  }

  loadData() {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());
    this.loadGhazalOfTheDay(scriptId);
    this.loadSelectedGhazals(scriptId);
    this.loadSelectedNazms(scriptId);

    // Load authors for carousel (strictly size: 3 for 3 cards per slide)
    this.loadCarouselAuthors(0);

    // Load authors for dropdown filter
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

  // --- Authors Carousel with size: 3 and Left/Right Arrows ---
  loadCarouselAuthors(page: number = 0) {
    this.authorCarouselLoading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.authorService.getEnrichedAuthorsPaged(scriptId, {
      page,
      size: 3,
      sortBy: 'id',
      sortDirection: 'asc'
    }).subscribe({
      next: (res) => {
        const list = res.data || (res as any).content || [];
        if (list.length > 0) {
          this.carouselAuthors.set(list);
          this.authorCarouselPage.set(res.page ?? page);
          const total = res.totalElements ?? list.length;
          this.authorCarouselTotalElements.set(total);
          this.authorCarouselTotalPages.set(res.totalPages || Math.ceil(total / 3) || 1);
          this.authorCarouselIsLast.set(res.last ?? (list.length < 3));
        } else if (page === 0) {
          this.setFallbackCarouselAuthors();
        } else {
          this.authorCarouselIsLast.set(true);
        }
        this.authorCarouselLoading.set(false);
      },
      error: () => {
        if (page === 0) {
          this.setFallbackCarouselAuthors();
        }
        this.authorCarouselLoading.set(false);
      }
    });
  }

  nextAuthorPage() {
    if (this.authorCarouselIsLast() || this.authorCarouselLoading()) return;
    const next = this.authorCarouselPage() + 1;
    this.loadCarouselAuthors(next);
  }

  prevAuthorPage() {
    if (this.authorCarouselPage() <= 0 || this.authorCarouselLoading()) return;
    const prev = this.authorCarouselPage() - 1;
    this.loadCarouselAuthors(prev);
  }

  goToAuthorPage(page: number) {
    if (page < 0 || page >= this.authorCarouselTotalPages() || this.authorCarouselLoading()) return;
    this.loadCarouselAuthors(page);
  }

  getCarouselPageArray(): number[] {
    const total = this.authorCarouselTotalPages();
    return Array.from({ length: Math.min(total, 12) }, (_, i) => i);
  }

  private setFallbackCarouselAuthors() {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoets.slice(0, 3).map(p => ({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: p.avatarUrl,
      primaryName: p.details[lang]?.name || p.details.ur.name,
      primaryBio: p.details[lang]?.biography || p.details.ur.biography
    }));
    this.carouselAuthors.set(list);
    this.authorCarouselTotalPages.set(Math.ceil(this.seedService.classicalPoets.length / 3));
    this.authorCarouselTotalElements.set(this.seedService.classicalPoets.length);
    this.authorCarouselIsLast.set(list.length < 3);
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
  // --- Selected Ghazals Carousel Methods ---
  loadSelectedGhazals(scriptId?: number) {
    this.selectedGhazalLoading.set(true);
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    this.contentService.getSelectedGhazals(sId).subscribe({
      next: (res) => {
        const list = res?.data || [];
        this.selectedGhazals.set(list);
        if (this.selectedGhazalIndex() >= list.length) {
          this.selectedGhazalIndex.set(0);
        }
        this.selectedGhazalLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load selected ghazals:', err);
        this.selectedGhazalLoading.set(false);
      }
    });
  }

  prevSelectedGhazal() {
    if (this.selectedGhazalIndex() > 0) {
      this.selectedGhazalIndex.update(i => i - 1);
    }
  }

  nextSelectedGhazal() {
    if (this.selectedGhazalIndex() < this.selectedGhazals().length - 1) {
      this.selectedGhazalIndex.update(i => i + 1);
    }
  }

  goToSelectedGhazal(index: number) {
    if (index >= 0 && index < this.selectedGhazals().length) {
      this.selectedGhazalIndex.set(index);
    }
  }

  changeSelectedGhazalFontSize(delta: number) {
    const newSize = this.selectedGhazalFontSize() + delta;
    if (newSize >= 18 && newSize <= 42) {
      this.selectedGhazalFontSize.set(newSize);
    }
  }

  copySelectedGhazalCouplet() {
    const ghazal = this.currentSelectedGhazal();
    if (!ghazal) return;
    const lines = this.getSelectedGhazalLines(ghazal);
    const poet = this.getSelectedGhazalPoetName(ghazal);
    const text = `${lines[0]}\n${lines[1]}\n\n— ${poet}\n(Via Unsiiyat Poetry - Rekhta Realm)`;
    navigator.clipboard.writeText(text);
    this.copiedSelectedGhazal.set(true);
    setTimeout(() => this.copiedSelectedGhazal.set(false), 2200);
  }

  getSelectedGhazalLines(ghazal?: Content | null): [string, string] {
    if (!ghazal) return ['', ''];
    const body = ghazal.primaryText?.body || '';
    const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length >= 2) {
      return [lines[0], lines[1]];
    }
    if (lines.length === 1) {
      return [lines[0], ghazal.title && ghazal.title !== lines[0] ? ghazal.title : ''];
    }
    return [ghazal.title || 'Selected Ghazal', ''];
  }

  getSelectedGhazalPoetName(ghazal?: Content | null): string {
    if (ghazal?.author) {
      const activeScript = this.scriptService.activeScript();
      if (activeScript === 'ur' && ghazal.author.urName) return ghazal.author.urName;
      if (activeScript === 'hi' && ghazal.author.hiName) return ghazal.author.hiName;
      if (ghazal.author.enName) return ghazal.author.enName;
      if (ghazal.author.primaryName) return ghazal.author.primaryName;
      if (ghazal.author.name) return ghazal.author.name;
    }
    return (ghazal as any)?.authorName || 'Master Shayar';
  }

  getSelectedGhazalPoetAvatar(ghazal?: Content | null): string {
    if (ghazal?.author) {
      return this.authorService.getAuthorAvatar(ghazal.author);
    }
    return 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100';
  }

  // --- Selected Nazms Carousel Methods ---
  loadSelectedNazms(scriptId?: number) {
    this.selectedNazmLoading.set(true);
    const sId = scriptId ?? this.scriptService.getScriptId(this.scriptService.activeScript());
    this.contentService.getSelectedNazms(sId).subscribe({
      next: (res) => {
        const list = res?.data || [];
        if (list.length > 0) {
          this.selectedNazms.set(list);
        } else {
          this.setFallbackSelectedNazms();
        }
        if (this.selectedNazmIndex() >= this.selectedNazms().length) {
          this.selectedNazmIndex.set(0);
        }
        this.selectedNazmLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load selected nazms:', err);
        this.setFallbackSelectedNazms();
        this.selectedNazmLoading.set(false);
      }
    });
  }

  private setFallbackSelectedNazms() {
    const lang = this.scriptService.activeScript();
    const fallbackNazms: Content[] = [
      {
        id: 101,
        title: lang === 'ur' ? 'بول کہ لب آزاد ہیں ترے' : lang === 'hi' ? 'बोल कि लब आज़ाद हैं तेरे' : 'Bol Ke Lab Azaad Hain Tere',
        author: {
          id: 4,
          primaryName: 'Faiz Ahmad Faiz',
          urName: 'فیض احمد فیض',
          hiName: 'फ़ैज़ अहमद फ़ैज़',
          enName: 'Faiz Ahmad Faiz',
          avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100'
        },
        primaryText: {
          id: 1,
          scriptId: 1,
          title: lang === 'ur' ? 'بول کہ لب آزاد ہیں ترے' : lang === 'hi' ? 'बोल कि लब आज़ाद हैं तेरे' : 'Bol Ke Lab Azaad Hain Tere',
          body: lang === 'ur'
            ? 'بول کہ لب آزاد ہیں ترے\nبول زبان اب تک تری ہے'
            : lang === 'hi'
            ? 'बोल कि लब आज़ाद हैं तेरे\nबोल ज़बाँ अब तक तिरी है'
            : 'Bol ke lab azaad hain tere\nBol zaban ab tak teri hai'
        }
      },
      {
        id: 102,
        title: lang === 'ur' ? 'تاج محل' : lang === 'hi' ? 'ताज महल' : 'Taj Mahal',
        author: {
          id: 6,
          primaryName: 'Sahir Ludhianvi',
          urName: 'ساحر لدھیانوی',
          hiName: 'साहिर लुधियानवी',
          enName: 'Sahir Ludhianvi',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'
        },
        primaryText: {
          id: 2,
          scriptId: 1,
          title: lang === 'ur' ? 'تاج محل' : lang === 'hi' ? 'ताज महल' : 'Taj Mahal',
          body: lang === 'ur'
            ? 'اک شہنشاہ نے دولت کا سہارا لے کر\nہم غریبوں کی محبت کا اڑایا ہے مذاق'
            : lang === 'hi'
            ? 'इक शहंशाह ने दौलत का सहारा ले कर\nहम ग़रीबों की मोहब्बत का उड़ाया है मज़ाक़'
            : 'Ik shehenshah ne daulat ka sahara le kar\nHum ghareebon ki mohabbat ka udaya hai mazaq'
        }
      }
    ];
    this.selectedNazms.set(fallbackNazms);
  }

  prevSelectedNazm() {
    if (this.selectedNazmIndex() > 0) {
      this.selectedNazmIndex.update(i => i - 1);
    }
  }

  nextSelectedNazm() {
    if (this.selectedNazmIndex() < this.selectedNazms().length - 1) {
      this.selectedNazmIndex.update(i => i + 1);
    }
  }

  goToSelectedNazm(index: number) {
    if (index >= 0 && index < this.selectedNazms().length) {
      this.selectedNazmIndex.set(index);
    }
  }

  changeSelectedNazmFontSize(delta: number) {
    const newSize = this.selectedNazmFontSize() + delta;
    if (newSize >= 18 && newSize <= 42) {
      this.selectedNazmFontSize.set(newSize);
    }
  }

  copySelectedNazmCouplet() {
    const nazm = this.currentSelectedNazm();
    if (!nazm) return;
    const lines = this.getSelectedNazmLines(nazm);
    const poet = this.getSelectedNazmPoetName(nazm);
    const text = `${lines[0]}\n${lines[1]}\n\n— ${poet}\n(Via Unsiiyat Poetry - Rekhta Realm)`;
    navigator.clipboard.writeText(text);
    this.copiedSelectedNazm.set(true);
    setTimeout(() => this.copiedSelectedNazm.set(false), 2200);
  }

  getSelectedNazmLines(nazm?: Content | null): [string, string] {
    if (!nazm) return ['', ''];
    const body = nazm.primaryText?.body || (nazm as any).contentTexts?.[0]?.body || (nazm as any).texts?.[0]?.body || '';
    const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (lines.length >= 2) {
      return [lines[0], lines[1]];
    }
    if (lines.length === 1) {
      return [lines[0], nazm.title && nazm.title !== lines[0] ? nazm.title : ''];
    }
    return [nazm.title || 'Selected Nazm', ''];
  }

  getSelectedNazmPoetName(nazm?: Content | null): string {
    if (nazm?.author) {
      const activeScript = this.scriptService.activeScript();
      if (activeScript === 'ur' && nazm.author.urName) return nazm.author.urName;
      if (activeScript === 'hi' && nazm.author.hiName) return nazm.author.hiName;
      if (nazm.author.enName) return nazm.author.enName;
      if (nazm.author.primaryName) return nazm.author.primaryName;
      if (nazm.author.name) return nazm.author.name;
    }
    return (nazm as any)?.authorName || 'Master Shayar';
  }

  getSelectedNazmPoetAvatar(nazm?: Content | null): string {
    if (nazm?.author) {
      return this.authorService.getAuthorAvatar(nazm.author);
    }
    return 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100';
  }
}
