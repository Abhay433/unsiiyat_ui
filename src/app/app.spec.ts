// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { App } from './app';

describe('App Component', () => {
  it('should be defined', () => {
    expect(App).toBeDefined();
  });
});
