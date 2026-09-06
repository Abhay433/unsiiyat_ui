import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly api = inject(ApiService);

  /**
   * Upload user profile photo via multipart/form-data to /api/users/profile/photo
   */
  uploadProfilePhoto(file: File): Observable<ApiResponse<string>> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.api.post<ApiResponse<string>>('/api/users/profile/photo', formData);
  }

  /**
   * Add new admin user (only SUPER_ADMIN can invoke this)
   */
  addAdminUser(data: { name: string; email: string; password: string }): Observable<ApiResponse<any>> {
    return this.api.post<ApiResponse<any>>('/api/users/add-admin', data);
  }

  /**
   * Fetch all platform admin users
   */
  getAdmins(): Observable<ApiResponse<any[]>> {
    return this.api.get<ApiResponse<any[]>>('/api/users/admins');
  }
}
