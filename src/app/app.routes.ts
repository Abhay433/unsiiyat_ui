import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PoetsComponent } from './pages/poets/poets.component';
import { PoetDetailComponent } from './pages/poet-detail/poet-detail.component';
import { ContentDetailComponent } from './pages/content-detail/content-detail.component';
import { GenresComponent } from './pages/genres/genres.component';
import { ThemesComponent } from './pages/themes/themes.component';
import { StudioComponent } from './pages/studio/studio.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Unsiiyat (انسیت) - Urdu & Hindi Poetry Realm' },
  { path: 'poets', component: PoetsComponent, title: 'Shayars & Poets - Unsiiyat' },
  { path: 'poet/:id', component: PoetDetailComponent, title: 'Poet Biography & Ghazals - Unsiiyat' },
  { path: 'content/:id', component: ContentDetailComponent, title: 'Ghazal Reader - Unsiiyat' },
  { path: 'genres', component: GenresComponent, title: 'Explore Genres - Unsiiyat' },
  { path: 'themes', component: ThemesComponent, title: 'Moods & Themes - Unsiiyat' },
  { path: 'admin/login', component: AdminLoginComponent, title: 'Admin Portal Login - Unsiiyat' },
  { path: 'admin', redirectTo: 'studio' },
  { path: 'studio', component: StudioComponent, canActivate: [adminGuard], title: 'Unsiiyat Studio & Admin' },
  { path: '**', redirectTo: '' }
];

