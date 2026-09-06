import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SearchService, SearchResultData, GenreSearchResultGroup } from '../../core/services/search.service';
import { ScriptService } from '../../core/services/script.service';
import { AuthorDto } from '../../core/models/author.models';
import { ContentDto } from '../../core/models/content.models';

export interface StaticWordMeaning {
  word: string;
  transliteration: string;
  partOfSpeech: string;
  definition: string;
  synonyms: string;
  exampleCouplet: string;
  poet: string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly searchService = inject(SearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  query = signal('');
  loading = signal(false);
  hasSearched = signal(false);
  searchData = signal<SearchResultData | null>(null);
  errorMessage = signal<string | null>(null);

  // Static dictionary / word meaning section (as requested)
  readonly staticWordMeanings: StaticWordMeaning[] = [
    {
      word: 'आरज़ू / آرزو',
      transliteration: 'Aarzoo',
      partOfSpeech: 'Noun (स्त्रीलिंग / اسم مؤنث)',
      definition: 'A deep yearning, heartfelt longing, desire or wish; a cherished longing of the lover’s soul.',
      synonyms: 'तमन्ना (Tamanna), ख़्वाहिश (Khwahish), हसरत (Hasrat), मुराद (Muraad)',
      exampleCouplet: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले\nबहुत निकले मिरे अरमान लेकिन फिर भी कम निकले',
      poet: 'Mirza Ghalib'
    },
    {
      word: 'रक़ीब / رقیب',
      transliteration: 'Raqeeb',
      partOfSpeech: 'Noun (पुल्लिंग / اسم مذकर)',
      definition: 'A rival or competitor in romantic courtship; historically portrayed with subtle wit and envy in classical poetry.',
      synonyms: 'प्रतिद्वंद्वी (Pratidwandi), हरीफ़ (Hareef), मुख़ालिफ़ (Mukhalif)',
      exampleCouplet: 'ग़ैरों से ले ली मैं ने मोहब्बत उधार पर\nऐ मेरे क़र्ज़-दार तुझे देर हो गई',
      poet: 'Zohaib Azmi'
    },
    {
      word: 'फ़िराक़ / فراق',
      transliteration: 'Firaaq',
      partOfSpeech: 'Noun (पुल्लिंग / اسم مذकर)',
      definition: 'Painful separation, absence from the beloved, heartache born of distance and unfulfilled longing.',
      synonyms: 'जुदाई (Judai), हिज्र (Hijr), विरह (Virah), फ़ासिला (Fasila)',
      exampleCouplet: 'फ़िराक़-ए-यार ने बे-चैन कर दिया दिल को\nवो आएँ भी तो मसीहा बना नहीं जाता',
      poet: 'Classical Master'
    },
    {
      word: 'सुख़न / سخن',
      transliteration: 'Sukhan',
      partOfSpeech: 'Noun (पुल्लिंग / اسم مذकर)',
      definition: 'Artistic poetic speech, verse creation, rhetorical eloquence that touches and elevates the listener’s soul.',
      synonyms: 'कविता (Kavita), कलाम (Kalaam), गुफ़्तगू (Guftagu), बयान (Bayaan)',
      exampleCouplet: 'हैं और भी दुनिया में सुख़न-वर बहुत अच्छे\nकहते हैं कि \'ग़ालिब\' का है अंदाज़-ए-बयाँ और',
      poet: 'Mirza Ghalib'
    }
  ];

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'] || params['text'] || '';
      this.query.set(q);
      if (q.trim()) {
        this.performSearch(q.trim());
      }
    });
  }

  onSearchSubmit() {
    const q = this.query().trim();
    if (q) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q },
        queryParamsHandling: 'merge'
      });
      this.performSearch(q);
    }
  }

  performSearch(text: string) {
    this.loading.set(true);
    this.hasSearched.set(true);
    this.errorMessage.set(null);

    this.searchService.search(text).subscribe({
      next: res => {
        this.loading.set(false);
        if (res && res.success) {
          this.searchData.set(res.data);
        } else {
          this.searchData.set(null);
        }
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set('Failed to fetch search results. Please try again.');
        console.error('Search error:', err);
      }
    });
  }

  // Helper to extract first two non-empty lines of body
  getFirstTwoLines(content: ContentDto): string[] {
    const active = this.scriptService.activeScript();
    let bodyText = '';

    if (content.contentTexts && content.contentTexts.length > 0) {
      // Find text matching active script if available
      const targetScriptId = this.scriptService.getScriptId(active);

      let match = content.contentTexts.find(t => t.scriptId === targetScriptId || this.scriptService.isScriptMatch(t, active));
      if (!match) {
        match = content.contentTexts[0];
      }
      bodyText = match?.body || '';
    } else if (content.primaryText) {
      bodyText = content.primaryText.body || '';
    }

    if (!bodyText) {
      return [];
    }

    return bodyText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 2);
  }

  getContentTitle(content: ContentDto): string {
    const active = this.scriptService.activeScript();

    if (content.contentTexts && content.contentTexts.length > 0) {
      const targetScriptId = this.scriptService.getScriptId(active);

      const match = content.contentTexts.find(t => t.scriptId === targetScriptId || this.scriptService.isScriptMatch(t, active));
      if (match && match.title) {
        return match.title;
      }
      return content.contentTexts[0]?.title || content.title;
    }

    return content.primaryText?.title || content.title;
  }

  getAuthorName(author?: AuthorDto): string {
    if (!author) return 'Unknown Shayar';
    const active = this.scriptService.activeScript();
    if (active === 'ur' && author.urName) return author.urName;
    if (active === 'hi' && author.hiName) return author.hiName;
    if (active === 'en' && author.enName) return author.enName;
    return author.primaryName || author.name || author.enName || 'Shayar';
  }

  getAuthorInitial(author: AuthorDto): string {
    const name = this.getAuthorName(author);
    return name ? name.charAt(0).toUpperCase() : '✒';
  }

  // Dummy load more handler as requested (does nothing for now)
  loadMore(sectionName: string) {
    // Intentionally no-op per user requirement
  }
}
