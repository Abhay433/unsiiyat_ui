import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService, ScriptCode } from '../../core/services/script.service';
import { ContentService } from '../../core/services/content.service';
import { AuthorService } from '../../core/services/author.service';
import { SeedDataService } from '../../core/services/seed-data.service';
import { DictionaryModalComponent } from '../../components/dictionary-modal/dictionary-modal.component';
import { ContentText } from '../../core/models/content.models';

@Component({
  selector: 'app-content-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DictionaryModalComponent],
  templateUrl: './content-detail.component.html',
  styleUrls: ['./content-detail.component.css']
})
export class ContentDetailComponent implements OnInit {
  readonly scriptService = inject(ScriptService);
  private readonly contentService = inject(ContentService);
  private readonly authorService = inject(AuthorService);
  readonly seedService = inject(SeedDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  contentId = signal<number>(1);
  content = signal<any>(null);
  allTexts = signal<any[]>([]);
  readerFontSize = signal(26); // px
  isPlayingAudio = signal(false);
  audioSeconds = signal(0);
  copiedIndex = signal<number | null>(null);
  dictWord = signal<string>('');
  showDict = signal(false);
  loading = signal(true);
  isBookmarked = signal(false);
  showShareToast = signal(false);

  // In-Place Edit Mode States
  isEditing = signal<boolean>(false);
  editScriptTab = signal<'ur' | 'hi' | 'en'>('ur');
  isSaving = signal<boolean>(false);
  editStatusMsg = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Single Couplet Inline Editing Signals
  editingCoupletIndex = signal<number>(-1);
  editingCoupletLine1 = signal<string>('');
  editingCoupletLine2 = signal<string>('');
  isSavingCouplet = signal<boolean>(false);

  editForm = signal({
    urTitle: '',
    urBody: '',
    hiTitle: '',
    hiBody: '',
    enTitle: '',
    enBody: ''
  });

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = Number(params['id']) || 1;
      this.contentId.set(id);
      // Instant render fallback only if it is an existing classical seed poem
      this.setFallbackContent(id);
      // Fetch fresh enriched data asynchronously from cache/backend
      this.loadContent(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  loadContent(id: number) {
    this.loading.set(true);
    const scriptId = this.scriptService.getScriptId(this.scriptService.activeScript());

    this.contentService.getContentDetailById(id, scriptId).subscribe({
      next: (found) => {
        if (found) {
          this.content.set(found);
          this.allTexts.set(found.texts || (found as any).contentTexts || []);
          if (this.isEditing()) {
            this.startEditing();
          }
        } else {
          this.setFallbackContent(id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.setFallbackContent(id);
        this.loading.set(false);
      }
    });
  }

  private setFallbackContent(id: number) {
    const lang = this.scriptService.activeScript();
    const poem = this.seedService.classicalPoems.find(p => p.id === id);
    if (!poem) {
      return;
    }
    const poet = this.seedService.classicalPoets.find(p => p.id === poem.authorId);

    const urText = poem.texts?.ur || { title: poem.title, body: '' };
    const hiText = poem.texts?.hi || { title: poem.title, body: '' };
    const enText = poem.texts?.en || { title: poem.title, body: '' };
    const activeText = poem.texts?.[lang] || urText;

    const enriched = {
      id: poem.id,
      title: poem.title,
      genreId: poem.genreId,
      authorId: poem.authorId,
      author: {
        id: poet?.id || poem.authorId,
        primaryName: poet?.details?.[lang]?.name || poet?.details?.ur?.name || 'Unknown Poet',
        primaryBio: poet?.details?.[lang]?.biography || poet?.details?.ur?.biography || '',
        avatarUrl: poet?.avatarUrl || ''
      },
      primaryText: activeText,
      allTexts: [
        { scriptId: this.scriptService.getScriptId('ur'), ...urText },
        { scriptId: this.scriptService.getScriptId('hi'), ...hiText },
        { scriptId: this.scriptService.getScriptId('en'), ...enText }
      ]
    };

    this.content.set(enriched);
    this.allTexts.set(enriched.allTexts);
  }

  private isUrdu(text?: string): boolean {
    if (!text) return false;
    return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  }

  private isHindi(text?: string): boolean {
    if (!text) return false;
    return /[\u0900-\u097F]/.test(text);
  }

  private isLatinOrEnglish(text?: string): boolean {
    if (!text) return false;
    return /[a-zA-Z]/.test(text) && !this.isUrdu(text) && !this.isHindi(text);
  }

  // In-Place Edit Actions
  startEditing() {
    const current = this.content();
    const texts = this.allTexts() || [];
    const active = this.scriptService.activeScript();
    const visibleText = this.currentPoemText();
    const visibleTitle = (visibleText?.title || current?.title || '').trim();
    const visibleBody = (visibleText?.body || '').trim();

    const ur = texts.find(t => this.scriptService.isScriptMatch(t, 'ur'));
    const hi = texts.find(t => this.scriptService.isScriptMatch(t, 'hi'));
    const en = texts.find(t => this.scriptService.isScriptMatch(t, 'en'));

    const fallbackUr = current?.texts?.find?.((t: any) => this.scriptService.isScriptMatch(t, 'ur'));
    const fallbackHi = current?.texts?.find?.((t: any) => this.scriptService.isScriptMatch(t, 'hi'));
    const fallbackEn = current?.texts?.find?.((t: any) => this.scriptService.isScriptMatch(t, 'en'));

    const seedItem = this.seedService.classicalPoems.find(p => p.id === this.contentId());

    // Urdu: only Urdu text
    let urTitle = ur?.title || fallbackUr?.title || '';
    if (!urTitle && (active === 'ur' || this.isUrdu(visibleTitle))) {
      urTitle = visibleTitle;
    }
    if (!urTitle && seedItem?.texts?.ur?.title) {
      urTitle = seedItem.texts.ur.title;
    }
    let urBody = ur?.body || fallbackUr?.body || (active === 'ur' ? visibleBody : '') || seedItem?.texts?.ur?.body || '';

    // Hindi: only Hindi text
    let hiTitle = hi?.title || fallbackHi?.title || '';
    if (!hiTitle && (active === 'hi' || this.isHindi(visibleTitle))) {
      hiTitle = visibleTitle;
    }
    if (!hiTitle && seedItem?.texts?.hi?.title) {
      hiTitle = seedItem.texts.hi.title;
    }
    let hiBody = hi?.body || fallbackHi?.body || (active === 'hi' ? visibleBody : '') || seedItem?.texts?.hi?.body || '';

    // English / Roman
    let enTitle = en?.title || fallbackEn?.title || '';
    if (!enTitle && (active === 'en' || this.isLatinOrEnglish(visibleTitle))) {
      enTitle = visibleTitle;
    }
    if (!enTitle && seedItem?.texts?.en?.title) {
      enTitle = seedItem.texts.en.title;
    }
    let enBody = en?.body || fallbackEn?.body || (active === 'en' ? visibleBody : '') || seedItem?.texts?.en?.body || '';

    // Fallbacks if one language is completely missing in database
    if (!urTitle && !hiTitle && !enTitle) {
      if (active === 'hi' || this.isHindi(visibleTitle)) hiTitle = visibleTitle;
      else if (active === 'ur' || this.isUrdu(visibleTitle)) urTitle = visibleTitle;
      else enTitle = visibleTitle || current?.title || '';
    }
    if (!urBody && !hiBody && !enBody && visibleBody) {
      if (active === 'hi' || this.isHindi(visibleBody)) hiBody = visibleBody;
      else if (active === 'ur' || this.isUrdu(visibleBody)) urBody = visibleBody;
      else enBody = visibleBody;
    }

    this.editForm.set({
      urTitle,
      urBody,
      hiTitle,
      hiBody,
      enTitle,
      enBody
    });

    this.editScriptTab.set(active);
    this.isEditing.set(true);
    window.scrollTo({ top: 120, behavior: 'smooth' });

    // Direct asynchronous DB fetch from content_texts table
    const id = this.contentId();
    if (id) {
      this.contentService.filterContentTexts({ contentId: id, size: 50 }).subscribe({
        next: (res) => {
          const raw = (res.data || []) as any[];
          if (raw.length > 0) {
            const freshTexts: ContentText[] = raw.map(t => {
              const rawId = Number(t.scriptId ?? t.script_id ?? t.script?.id);
              const detected = this.scriptService.detectScriptFromText((t.title || '') + ' ' + (t.body || ''));
              const finalSId = rawId || this.scriptService.getScriptId(detected);
              if (rawId) {
                this.scriptService.learnScriptId(rawId, detected);
              }
              return {
                id: t.id,
                contentId: Number(t.contentId ?? t.content_id ?? t.content?.id ?? id),
                scriptId: finalSId,
                title: t.title || '',
                body: t.body || ''
              };
            });

            this.allTexts.set(freshTexts);

            const fUr = freshTexts.find(t => this.scriptService.isScriptMatch(t, 'ur'));
            const fHi = freshTexts.find(t => this.scriptService.isScriptMatch(t, 'hi'));
            const fEn = freshTexts.find(t => this.scriptService.isScriptMatch(t, 'en'));

            this.editForm.update(curr => ({
              urTitle: fUr?.title || curr.urTitle,
              urBody: fUr?.body || curr.urBody,
              hiTitle: fHi?.title || curr.hiTitle,
              hiBody: fHi?.body || curr.hiBody,
              enTitle: fEn?.title || curr.enTitle,
              enBody: fEn?.body || curr.enBody
            }));
          }
        },
        error: (err) => console.warn('Could not fetch direct content_texts on edit:', err)
      });
    }
  }

  cancelEditing() {
    this.isEditing.set(false);
  }

  getActiveEditTitle(): string {
    const tab = this.editScriptTab();
    const f = this.editForm();
    if (tab === 'ur') return f.urTitle;
    if (tab === 'hi') return f.hiTitle;
    return f.enTitle;
  }

  updateActiveEditTitle(val: string) {
    const tab = this.editScriptTab();
    this.editForm.update(f => {
      if (tab === 'ur') return { ...f, urTitle: val };
      if (tab === 'hi') return { ...f, hiTitle: val };
      return { ...f, enTitle: val };
    });
  }

  getActiveEditBody(): string {
    const tab = this.editScriptTab();
    const f = this.editForm();
    if (tab === 'ur') return f.urBody;
    if (tab === 'hi') return f.hiBody;
    return f.enBody;
  }

  updateActiveEditBody(val: string) {
    const tab = this.editScriptTab();
    this.editForm.update(f => {
      if (tab === 'ur') return { ...f, urBody: val };
      if (tab === 'hi') return { ...f, hiBody: val };
      return { ...f, enBody: val };
    });
  }

  formatActiveEditCouplets() {
    const raw = this.getActiveEditBody();
    if (!raw.trim()) return;
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const couplets: string[] = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (i + 1 < lines.length) {
        couplets.push(`${lines[i]}\n${lines[i + 1]}`);
      } else {
        couplets.push(lines[i]);
      }
    }
    const formatted = couplets.join('\n\n');
    this.updateActiveEditBody(formatted);
    this.showEditStatus('success', `✨ Formatted into ${Math.ceil(lines.length / 2)} Ash'ar (${lines.length} Misre).`);
  }

  readonly editCoupletsPreview = computed<string[][]>(() => {
    const tab = this.editScriptTab();
    const f = this.editForm();
    const body = tab === 'ur' ? f.urBody : (tab === 'hi' ? f.hiBody : f.enBody);
    if (!body || !body.trim()) return [];
    const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const result: string[][] = [];
    for (let i = 0; i < lines.length; i += 2) {
      result.push([lines[i], lines[i + 1] || '']);
    }
    return result;
  });

  readonly activeCoupletStats = computed(() => {
    const tab = this.editScriptTab();
    const f = this.editForm();
    const body = tab === 'ur' ? f.urBody : (tab === 'hi' ? f.hiBody : f.enBody);
    if (!body || !body.trim()) return { lines: 0, couplets: 0 };
    const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return {
      lines: lines.length,
      couplets: Math.ceil(lines.length / 2)
    };
  });

  saveEditedContent() {
    const f = this.editForm();
    const c = this.content();
    const id = this.contentId();

    const finalTitle = (
      f.enTitle.trim() ||
      f.urTitle.trim() ||
      f.hiTitle.trim() ||
      c?.title ||
      (f.urBody || f.hiBody || f.enBody || '').split('\n').map(l => l.trim()).find(l => l.length > 0) ||
      'Untitled Kalam'
    ).trim();

    if (!f.urBody.trim() && !f.hiBody.trim() && !f.enBody.trim() && !f.urTitle.trim() && !f.hiTitle.trim() && !f.enTitle.trim()) {
      this.showEditStatus('error', 'Please enter some poetry verses before saving.');
      return;
    }

    this.isSaving.set(true);

    const scriptTexts: {
      ur?: { title: string; body: string };
      hi?: { title: string; body: string };
      en?: { title: string; body: string };
    } = {};

    if (f.urBody.trim() || f.urTitle.trim()) {
      scriptTexts.ur = {
        title: f.urTitle.trim() || (this.isUrdu(finalTitle) ? finalTitle : (f.urBody.split('\n')[0]?.trim() || finalTitle)),
        body: f.urBody.trim()
      };
    }

    if (f.hiBody.trim() || f.hiTitle.trim()) {
      scriptTexts.hi = {
        title: f.hiTitle.trim() || (this.isHindi(finalTitle) ? finalTitle : (f.hiBody.split('\n')[0]?.trim() || '')),
        body: f.hiBody.trim()
      };
    }

    if (f.enBody.trim() || f.enTitle.trim()) {
      scriptTexts.en = {
        title: f.enTitle.trim() || (this.isLatinOrEnglish(finalTitle) ? finalTitle : (f.enBody.split('\n')[0]?.trim() || '')),
        body: f.enBody.trim()
      };
    }

    const authorId = c?.authorId || c?.author?.id || 1;
    const genreId = c?.genreId || c?.genre?.id || 1;
    const themeIds = c?.themeIds || (c?.themes ? c.themes.map((t: any) => t.id) : [1]);

    this.contentService.saveCompleteContentWithTexts(
      {
        id,
        title: finalTitle,
        authorId,
        genreId,
        themeIds
      },
      scriptTexts,
      this.allTexts() || []
    ).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showEditStatus('success', `🎉 "${finalTitle}" saved successfully!`);

        const existingTexts = this.allTexts() || [];
        const exUr = existingTexts.find(t => this.scriptService.isScriptMatch(t, 'ur'));
        const exHi = existingTexts.find(t => this.scriptService.isScriptMatch(t, 'hi'));
        const exEn = existingTexts.find(t => this.scriptService.isScriptMatch(t, 'en'));

        const urSId = exUr?.scriptId || this.scriptService.getScriptId('ur');
        const hiSId = exHi?.scriptId || this.scriptService.getScriptId('hi');
        const enSId = exEn?.scriptId || this.scriptService.getScriptId('en');

        // Update local state with script-distinct records
        const updatedTexts: ContentText[] = [
          { id: exUr?.id, contentId: id, scriptId: urSId, title: scriptTexts.ur?.title || '', body: scriptTexts.ur?.body || '' },
          { id: exHi?.id, contentId: id, scriptId: hiSId, title: scriptTexts.hi?.title || '', body: scriptTexts.hi?.body || '' },
          { id: exEn?.id, contentId: id, scriptId: enSId, title: scriptTexts.en?.title || '', body: scriptTexts.en?.body || '' }
        ];

        this.allTexts.set(updatedTexts);
        const activeLang = this.scriptService.activeScript();
        const activeText = activeLang === 'ur' ? scriptTexts.ur : (activeLang === 'hi' ? scriptTexts.hi : scriptTexts.en);

        this.content.update(curr => ({
          ...curr,
          title: finalTitle,
          texts: updatedTexts,
          primaryText: activeText || { title: finalTitle, body: '' }
        }));

        // Update seed fallback if exists
        const seedItem = this.seedService.classicalPoems.find(p => p.id === id);
        if (seedItem) {
          seedItem.title = finalTitle;
          seedItem.texts = {
            ur: scriptTexts.ur || { title: finalTitle, body: '' },
            hi: scriptTexts.hi || { title: finalTitle, body: '' },
            en: scriptTexts.en || { title: finalTitle, body: '' }
          };
        }

        this.isEditing.set(false);
        this.loadContent(id);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.showEditStatus('error', err?.error?.message || err?.message || 'Failed to save changes.');
      }
    });
  }

  showEditStatus(type: 'success' | 'error', text: string) {
    this.editStatusMsg.set({ type, text });
    setTimeout(() => this.editStatusMsg.set(null), 4500);
  }

  // Get current active script text dynamically
  readonly currentPoemText = computed(() => {
    const lang = this.scriptService.activeScript();
    const texts = this.allTexts();

    if (texts && texts.length > 0) {
      const match = texts.find(t => this.scriptService.isScriptMatch(t, lang));
      if (match && (match.title?.trim() || match.body?.trim())) {
        return match;
      }
    }

    // Fallback: Check seed
    const seedItem = this.seedService.classicalPoems.find(p => p.id === this.contentId());
    if (seedItem?.texts?.[lang]) {
      return seedItem.texts[lang];
    }

    if (texts && texts.length > 0) {
      const match = texts.find(t => this.scriptService.isScriptMatch(t, lang));
      if (match) return match;
      const firstWithBody = texts.find(t => t.body?.trim());
      if (firstWithBody) return firstWithBody;
      return texts[0];
    }

    return this.content()?.primaryText || { title: this.content()?.title || 'Untitled Kalam', body: '' };
  });

  // Memoized couplets computed signal - zero change-detection loop
  readonly couplets = computed(() => {
    const body = this.currentPoemText()?.body || '';
    const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const result: { line1: string; line2: string; words1: string[]; words2: string[] }[] = [];

    for (let i = 0; i < lines.length; i += 2) {
      const l1 = lines[i] || '';
      const l2 = lines[i + 1] || '';
      result.push({
        line1: l1,
        line2: l2,
        words1: l1.split(' ').filter((w: string) => w.trim().length > 0),
        words2: l2.split(' ').filter((w: string) => w.trim().length > 0)
      });
    }
    return result;
  });

  trackByIndex(index: number): number {
    return index;
  }

  startEditingCouplet(idx: number, couplet: { line1: string; line2: string }) {
    this.editingCoupletIndex.set(idx);
    this.editingCoupletLine1.set(couplet.line1 || '');
    this.editingCoupletLine2.set(couplet.line2 || '');
  }

  cancelEditingCouplet() {
    this.editingCoupletIndex.set(-1);
    this.editingCoupletLine1.set('');
    this.editingCoupletLine2.set('');
  }

  saveEditingCouplet(idx: number) {
    const l1 = this.editingCoupletLine1().trim();
    const l2 = this.editingCoupletLine2().trim();

    if (!l1 && !l2) {
      this.showEditStatus('error', 'Sher lines cannot be empty.');
      return;
    }

    const current = this.couplets();
    const coupletList = current.map(c => [c.line1, c.line2]);
    if (idx >= 0 && idx < coupletList.length) {
      coupletList[idx] = [l1, l2];
    }

    const newBody = coupletList
      .map(c => c.filter(l => l && l.trim()).join('\n'))
      .filter(cText => cText.trim().length > 0)
      .join('\n\n');

    const contentId = this.contentId();
    const activeLang = this.scriptService.activeScript();
    const existingText = (this.allTexts() || []).find(t => this.scriptService.isScriptMatch(t, activeLang));
    const scriptId = existingText?.scriptId || this.scriptService.getScriptId(activeLang);
    const title = this.currentPoemText()?.title || this.content()?.title || 'Untitled Kalam';

    this.isSavingCouplet.set(true);

    this.contentService.saveContentText({
      id: existingText?.id,
      contentId,
      scriptId,
      title,
      body: newBody
    }).subscribe({
      next: () => {
        this.isSavingCouplet.set(false);

        // Update allTexts signal
        this.allTexts.update(texts => {
          const list = texts ? [...texts] : [];
          const matchIndex = list.findIndex(t => this.scriptService.isScriptMatch(t, activeLang));
          if (matchIndex >= 0) {
            list[matchIndex] = { ...list[matchIndex], body: newBody, title };
          } else {
            list.push({ contentId, scriptId, title, body: newBody });
          }
          return list;
        });

        // Update content signal
        this.content.update(curr => {
          if (!curr) return curr;
          return {
            ...curr,
            primaryText: { title, body: newBody }
          };
        });

        // Update seed if present
        const seedItem = this.seedService.classicalPoems.find(p => p.id === contentId);
        if (seedItem?.texts?.[activeLang]) {
          seedItem.texts[activeLang].body = newBody;
        }

        this.editingCoupletIndex.set(-1);
        this.showEditStatus('success', `🎉 Sher #${idx + 1} updated successfully!`);
      },
      error: (err) => {
        this.isSavingCouplet.set(false);
        this.showEditStatus('error', err?.error?.message || err?.message || 'Failed to save sher.');
      }
    });
  }

  getWords(line: string): string[] {
    return line.split(' ').filter(w => w.trim().length > 0);
  }

  getGenreName(): string {
    const lang = this.scriptService.activeScript();
    const c = this.content();
    const gid = c?.genreId || c?.genre?.id || 1;
    const slug = (c?.genre?.slug || (gid === 1 ? 'ghazal' : gid === 2 ? 'nazm' : gid === 3 ? 'sher' : gid === 4 ? 'rubai' : 'ghazal')).toLowerCase();

    const genreMap: Record<string, Record<ScriptCode, string>> = {
      ghazal: { ur: 'غزل', hi: 'ग़ज़ल', en: 'Ghazal' },
      nazm: { ur: 'نظم', hi: 'नज़्म', en: 'Nazm' },
      sher: { ur: 'شعر', hi: 'शेर', en: 'Sher / Couplet' },
      rubai: { ur: 'رباعی', hi: 'रुबाई', en: 'Rubai' },
      qasida: { ur: 'قصیدہ', hi: 'क़सीदा', en: 'Qasida' },
      marsiya: { ur: 'مرثیہ', hi: 'मर्सिया', en: 'Marsiya' },
      masnavi: { ur: 'مثنوی', hi: 'मसनवी', en: 'Masnavi' }
    };
    return genreMap[slug]?.[lang] || (lang === 'ur' ? 'غزل' : (lang === 'hi' ? 'ग़ज़ल' : 'Ghazal'));
  }

  getAuthorName(): string {
    const lang = this.scriptService.activeScript();
    const c = this.content();
    if (!c) return 'Legendary Poet';

    const author = c.author;
    if (author) {
      if (lang === 'ur' && author.urName) return author.urName;
      if (lang === 'hi' && author.hiName) return author.hiName;
      if (lang === 'en' && author.enName) return author.enName;

      if (Array.isArray(author.details)) {
        const d = author.details.find((x: any) => this.scriptService.isScriptMatch({ scriptId: x.scriptId, title: x.name, body: x.biography }, lang));
        if (d?.name) return d.name;
      }
      if (author.primaryName) return author.primaryName;
    }

    const seedPoet = this.seedService.classicalPoets.find(p => p.id === c.authorId);
    if (seedPoet?.details?.[lang]?.name) return seedPoet.details[lang].name;

    return c.author?.primaryName || (lang === 'ur' ? 'شاعر' : (lang === 'hi' ? 'शायर' : 'Poet'));
  }

  getAuthorBio(): string {
    const lang = this.scriptService.activeScript();
    const c = this.content();
    const author = c?.author;

    if (author) {
      if (Array.isArray(author.details)) {
        const d = author.details.find((x: any) => this.scriptService.isScriptMatch({ scriptId: x.scriptId, title: x.name, body: x.biography }, lang));
        if (d?.biography) return d.biography;
      }
      if (author.primaryBio) return author.primaryBio;
    }

    const seedPoet = this.seedService.classicalPoets.find(p => p.id === c?.authorId);
    if (seedPoet?.details?.[lang]?.biography) return seedPoet.details[lang].biography;

    return (
      author?.primaryBio ||
      (lang === 'ur'
        ? 'اردو و ہندی کلاسیکی شاعری کا عظیم و لافانی ورثہ۔'
        : (lang === 'hi'
          ? 'उर्दू व हिन्दी शास्त्रीय शायरी की अनमोल धरोहर।'
          : 'Celebrated classical master poet of timeless poetic tradition.'))
    );
  }

  getCoupletNumeral(idx: number): string {
    const lang = this.scriptService.activeScript();
    const urduNums = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱', '۱۲', '۱۳', '۱۴', '۱۵', '۱۶', '۱۷', '۱۸', '۱۹', '۲۰'];
    const hindiNums = ['१', '२', '३', '४', '५', '६', '७', '८', '९', '१०', '११', '१२', '१३', '१४', '१५', '१६', '१७', '१८', '१९', '२०'];
    const num = idx + 1;
    if (lang === 'ur') return `شعر ${urduNums[idx] || num}`;
    if (lang === 'hi') return `शेर ${hindiNums[idx] || num}`;
    return `Sher #${num}`;
  }

  getPoemDirection(): 'rtl' | 'ltr' {
    return this.scriptService.activeScript() === 'ur' ? 'rtl' : 'ltr';
  }

  getPoemFontClass(): string {
    const lang = this.scriptService.activeScript();
    if (lang === 'ur') return 'font-urdu';
    if (lang === 'hi') return 'font-hindi';
    return 'font-english';
  }

  changeFontSize(delta: number) {
    const size = this.readerFontSize() + delta;
    if (size >= 18 && size <= 42) {
      this.readerFontSize.set(size);
    }
  }

  switchScript(code: ScriptCode) {
    this.scriptService.setScript(code);
  }

  getCoupletStats(text: string): { lines: number; couplets: number } {
    if (!text || !text.trim()) return { lines: 0, couplets: 0 };
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return {
      lines: lines.length,
      couplets: Math.ceil(lines.length / 2)
    };
  }

  editInStudio() {
    this.startEditing();
  }

  toggleAudio() {
    this.isPlayingAudio.update(v => !v);
    if (this.isPlayingAudio()) {
      this.audioSeconds.set(0);
      const timer = setInterval(() => {
        if (!this.isPlayingAudio()) {
          clearInterval(timer);
          return;
        }
        this.audioSeconds.update(s => s + 1);
      }, 1000);
    }
  }

  copyCouplet(index: number, couplet: string[]) {
    const poet = this.getAuthorName();
    const text = `${couplet[0]}\n${couplet[1]}\n\n— ${poet}\n(Via Unsiiyat Poetry - Rekhta Realm)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  copyFullGhazal() {
    const poet = this.getAuthorName();
    const title = this.currentPoemText()?.title || '';
    const body = this.currentPoemText()?.body || '';
    const text = `${title}\n\n${body}\n\n— ${poet}\n(Read more on Unsiiyat Poetry)`;
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(-1);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }

  openDictionary(word: string = '') {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?۔]/g, '').trim();
    this.dictWord.set(cleanWord);
    this.showDict.set(true);
  }

  toggleBookmark() {
    this.isBookmarked.update(v => !v);
  }

  shareKalam() {
    if (navigator.share) {
      navigator.share({
        title: this.currentPoemText()?.title || 'Unsiiyat Poetry',
        text: `Read "${this.currentPoemText()?.title}" by ${this.getAuthorName()} on Unsiiyat Poetry`,
        url: window.location.href
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.showShareToast.set(true);
      setTimeout(() => this.showShareToast.set(false), 2500);
    }
  }

  navigateToPreviousGhazal() {
    const all = this.seedService.classicalPoems;
    const currentIdx = all.findIndex(p => p.id === this.contentId());
    const prevIdx = (currentIdx - 1 + all.length) % all.length;
    this.router.navigate(['/content', all[prevIdx].id]);
  }

  navigateToNextGhazal() {
    const all = this.seedService.classicalPoems;
    const currentIdx = all.findIndex(p => p.id === this.contentId());
    const nextIdx = (currentIdx + 1) % all.length;
    this.router.navigate(['/content', all[nextIdx].id]);
  }
}
