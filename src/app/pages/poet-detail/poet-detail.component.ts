import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ScriptService } from '../../core/services/script.service';
import { AuthorService } from '../../core/services/author.service';
import { ContentService } from '../../core/services/content.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-poet-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './poet-detail.component.html',
  styleUrls: ['./poet-detail.component.css']
})
export class PoetDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);
  private readonly userService = inject(UserService);
  readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);

  poetId = signal<number>(1);
  poet = signal<any>(null);
  poetContents = signal<any[]>([]);
  activeTab = signal<'ghazals' | 'ashar' | 'bio'>('ghazals');
  copiedIndex = signal<number | null>(null);
  loading = signal(true);
  isUploading = signal<boolean>(false);
  uploadStatusMsg = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  constructor() {
    effect(() => {
      this.scriptService.activeScript();
      if (this.poetId()) {
        this.loadPoetData(this.poetId());
      }
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']) || 1;
      this.poetId.set(id);
      this.loadPoetData(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  triggerPhotoUpload(fileInput: HTMLInputElement) {
    if (fileInput) {
      fileInput.click();
    }
  }

  onAuthorPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.showStatus('error', 'Please select a valid image file (PNG, JPG, WebP).');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showStatus('error', 'Image size must be less than 5MB.');
      input.value = '';
      return;
    }

    this.isUploading.set(true);
    this.userService.uploadProfilePhoto(file).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        const photoUrl = res.data;
        if (photoUrl) {
          const current = this.poet();
          if (current) {
            this.poet.set({ ...current, avatarUrl: photoUrl });
          }
          const id = this.poetId();
          if (id) {
            localStorage.setItem(`author_avatar_${id}`, photoUrl);
          }
          this.showStatus('success', 'Author photo updated successfully!');
        } else {
          this.showStatus('success', 'Photo uploaded!');
        }
        input.value = '';
      },
      error: (err) => {
        this.isUploading.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to upload photo.';
        this.showStatus('error', msg);
        input.value = '';
      }
    });
  }

  private showStatus(type: 'success' | 'error', text: string) {
    this.uploadStatusMsg.set({ type, text });
    setTimeout(() => this.uploadStatusMsg.set(null), 4000);
  }

  loadPoetData(id: number) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());
    const cachedAvatar = localStorage.getItem(`author_avatar_${id}`);

    this.authorService.getEnrichedAuthors(scriptId).subscribe({
      next: (authors) => {
        const found = authors.find(a => a.id === id);
        if (found) {
          if (cachedAvatar) {
            found.avatarUrl = cachedAvatar;
          }
          this.poet.set(found);
        } else {
          this.setFallbackPoet(id);
        }
      },
      error: () => this.setFallbackPoet(id)
    });

    this.contentService.getContentsByAuthorId(id, scriptId).subscribe({
      next: (filtered) => {
        if (filtered && filtered.length > 0) {
          this.poetContents.set(filtered);
        } else {
          this.setFallbackContents(id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallbackContents(id);
        this.loading.set(false);
      }
    });
  }

  private setFallbackPoet(id: number) {
    const lang = this.scriptService.activeScript();
    const p = this.seedService.classicalPoets.find(item => item.id === id) || this.seedService.classicalPoets[0];
    const cachedAvatar = localStorage.getItem(`author_avatar_${id}`);
    this.poet.set({
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      avatarUrl: cachedAvatar || p.avatarUrl,
      primaryName: p.details[lang]?.name || p.details.ur.name,
      primaryBio: p.details[lang]?.biography || p.details.ur.biography
    });
  }

  private setFallbackContents(id: number) {
    const lang = this.scriptService.activeScript();
    const list = this.seedService.classicalPoems
      .filter(poem => poem.authorId === id)
      .map(poem => ({
        id: poem.id,
        title: poem.title,
        genreId: poem.genreId,
        primaryText: poem.texts[lang] || poem.texts.ur,
        themeIds: poem.themeIds
      }));
    this.poetContents.set(list);
  }

  copyCouplet(index: number, lines: string[]) {
    const text = `${lines.join('\n')}\n\n— ${this.poet()?.primaryName}\n(Via Unsiiyat Poetry)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  getFirstCouplet(body?: string): string[] {
    if (!body) return ['', ''];
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return [lines[0] || '', lines[1] || ''];
  }
}
