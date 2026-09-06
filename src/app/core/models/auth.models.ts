export type UserRole = 'USER' | 'ADMIN';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  role: UserRole;
  email: string;
  name: string;
  profilePictureUrl?: string;
}

export interface CurrentUser {
  id?: number;
  name: string;
  email: string;
  role: UserRole;
  profilePictureUrl?: string;
}
