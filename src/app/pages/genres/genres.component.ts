import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScriptService } from '../../core/services/script.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { Genre } from '../../core/models/taxonomy.models';

@Component({
  selector: 'app-genres',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './genres.component.html',
  styleUrls: ['./genres.component.css']
})
export class GenresComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly seedService = inject(SeedDataService);

  genres = signal<Genre[]>([]);
  loading = signal<boolean>(true);

  ngOnInit() {
    this.taxonomyService.getAllGenres().subscribe({
      next: (list) => {
        const genres = list && list.length > 0 ? list : this.seedService.initialGenres;
        this.genres.set(genres);
        this.loading.set(false);
      },
      error: () => {
        this.genres.set(this.seedService.initialGenres);
        this.loading.set(false);
      }
    });
  }

  getGenreIcon(slug?: string): string {
    const s = (slug || '').toLowerCase();
    switch (s) {
      case 'ghazal': return '📜';
      case 'nazm': return '📑';
      case 'sher':
      case 'ashar': return '✒️';
      case 'rubai': return '🪶';
      case 'qasida': return '👑';
      case 'marsiya': return '🕯️';
      case 'masnavi': return '📖';
      case 'afsana': return '📖';
      case 'mazmuun':
      case 'mazmoon': return '✍️';
      case 'dastan': return '🏰';
      default: return '📜';
    }
  }

  getGenreUrduTitle(slug?: string): string {
    const s = (slug || '').toLowerCase();
    switch (s) {
      case 'ghazal': return 'غزلِ کلاسیک';
      case 'nazm': return 'نظمِ جدید و قدیم';
      case 'sher':
      case 'ashar': return 'منتخب اشعار';
      case 'rubai': return 'رباعیاتِ معرفت';
      case 'qasida': return 'قصائدِ مدحیہ';
      case 'marsiya': return 'مراثیِ شہداء';
      case 'afsana': return 'افسانہ نگاری';
      case 'mazmuun':
      case 'mazmoon': return 'مضامین و مقالات';
      default: return 'صنفِ سخن';
    }
  }

  getGenreHindiTitle(slug?: string): string {
    const s = (slug || '').toLowerCase();
    switch (s) {
      case 'ghazal': return 'क्लासिकल ग़ज़लें';
      case 'nazm': return 'नज़्म व आधुनिक विचार';
      case 'sher':
      case 'ashar': return 'अशआर व चुनिंदा शेर';
      case 'rubai': return 'रुबाइयात व चौपाई';
      case 'qasida': return 'क़सीदा व स्तुति';
      case 'marsiya': return 'मर्सिया व शोकगीत';
      case 'afsana': return 'अफ़साना व लघु कथाएँ';
      case 'mazmuun':
      case 'mazmoon': return 'मज़मून व साहित्यिक निबंध';
      default: return 'काव्य विधा';
    }
  }

  getGenreDescription(slug?: string): string {
    const s = (slug || '').toLowerCase();
    switch (s) {
      case 'ghazal':
        return 'Classic stanzas of rhythmic meter (Beh\'r), strict rhyme (Qafiya), and melodious refrain (Radif). Explores profound romance, mysticism, and life philosophy.';
      case 'nazm':
        return 'Thematic continuous verse expressing unified narrative, modern consciousness, socio-political commentary, and revolutionary ideals.';
      case 'afsana':
        return 'Classic and contemporary Urdu short prose fiction capturing intricate human emotions, societal realities, and deep character narratives.';
      case 'mazmuun':
      case 'mazmoon':
        return 'Thoughtful literary essays, critical treatises, and philosophical discourses reflecting on culture, ethics, and art.';
      case 'sher':
      case 'ashar':
        return 'Standalone two-line master couplets capable of capturing the essence of entire libraries of human thought and emotion in a singular breath.';
      case 'rubai':
        return 'Four-line Persian & Urdu classical quatrains following an AABA rhyme pattern, renowned for delivering philosophical epiphanies and wit.';
      case 'qasida':
        return 'Grand, rolling panegyrics written in elaborate poetic forms to praise patrons, saints, and virtuous ideals.';
      case 'marsiya':
        return 'Sorrowful elegies commemorating historical valor, sacrifice, and spiritual martyrdom with unparalleled poetic eloquence.';
      default:
        return 'Explore the rich heritage of classical Urdu and Hindi literary expressions, rhythmic meters, and prose.';
    }
  }

  getGenreMeterTag(slug?: string): string {
    const s = (slug || '').toLowerCase();
    switch (s) {
      case 'ghazal': return 'Radif + Qafiya + Bahr';
      case 'nazm': return 'Free / Blank / Thematic Verse';
      case 'sher': return 'Two-line Bait';
      case 'rubai': return 'AABA Quatrain Meter';
      case 'qasida': return 'Extended Monorhyme';
      case 'marsiya': return 'Musaddas (6-line stanzas)';
      default: return 'Classical Meter';
    }
  }
}
