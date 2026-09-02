import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeedDataService } from '../../core/services/seed-data.service';
import { ScriptService } from '../../core/services/script.service';

@Component({
  selector: 'app-dictionary-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dictionary-modal.component.html',
  styleUrls: ['./dictionary-modal.component.css']
})
export class DictionaryModalComponent {
  private readonly seedDataService = inject(SeedDataService);
  readonly scriptService = inject(ScriptService);

  @Input() selectedWord: string = '';
  @Output() close = new EventEmitter<void>();

  searchQuery = signal('');

  get wordList() {
    const dict = this.seedDataService.dictionaryWords;
    const query = this.searchQuery().toLowerCase().trim();
    const entries = Object.entries(dict);

    if (!query) return entries;

    return entries.filter(([word, meanings]) => {
      return word.toLowerCase().includes(query) ||
             meanings.ur.toLowerCase().includes(query) ||
             meanings.hi.toLowerCase().includes(query) ||
             meanings.en.toLowerCase().includes(query);
    });
  }
}
