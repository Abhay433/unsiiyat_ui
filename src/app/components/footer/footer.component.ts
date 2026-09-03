import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScriptService } from '../../core/services/script.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  readonly scriptService = inject(ScriptService);
  readonly currentYear = new Date().getFullYear();

  newsletterEmail = signal('');
  isSubscribed = signal(false);
  toastMessage = signal<string | null>(null);

  onSubscribe(event: Event) {
    event.preventDefault();
    const email = this.newsletterEmail().trim();
    if (email && email.includes('@')) {
      this.isSubscribed.set(true);
      this.showToast(this.scriptService.translate('subscribed_msg'));
      this.newsletterEmail.set('');
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }
}
