import { BaseFilterRequest } from './api-response.models';

export interface Author {
  id?: number;
  birthDate?: string; // YYYY-MM-DD
  deathDate?: string; // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
  // UI enriched properties
  details?: AuthorDetail[];
  primaryName?: string;
  primaryBio?: string;
  avatarUrl?: string;
  worksCount?: number;
}

export interface AuthorDetail {
  id?: number;
  authorId: number;
  scriptId: number;
  name: string;
  biography?: string;
}

export interface AuthorFilterRequest extends BaseFilterRequest {
  birthDate?: string;
  deathDate?: string;
}

export interface AuthorDetailFilterRequest extends BaseFilterRequest {
  authorId?: number;
  scriptId?: number;
  name?: string;
}
