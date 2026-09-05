import { BaseFilterRequest } from './api-response.models';

export interface Author {
  id?: number;
  birthDate?: string; // YYYY-MM-DD
  deathDate?: string; // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
  // UI enriched properties
  name?: string;
  primaryName?: string;
  urName?: string;
  hiName?: string;
  enName?: string;
  details?: AuthorDetail[];
  authorDetails?: AuthorDetail[];
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
  id?: number;
  birthDate?: string;
  deathDate?: string;
}

export interface AuthorDetailFilterRequest extends BaseFilterRequest {
  authorId?: number;
  scriptId?: number;
  name?: string;
}
