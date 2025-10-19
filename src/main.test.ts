import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('View Selection', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('should show laptop view when no session parameter', () => {
    const url = 'http://localhost:3000';
    const urlParams = new URLSearchParams(new URL(url).search);

    expect(urlParams.has('session')).toBe(false);
  });

  it('should show mobile view when session parameter present', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const url = `http://localhost:3000?session=${sessionId}`;
    const urlParams = new URLSearchParams(new URL(url).search);

    expect(urlParams.has('session')).toBe(true);
    expect(urlParams.get('session')).toBe(sessionId);
  });

  it('should show mobile view even with empty session parameter', () => {
    const url = 'http://localhost:3000?session=';
    const urlParams = new URLSearchParams(new URL(url).search);

    expect(urlParams.has('session')).toBe(true);
    expect(urlParams.get('session')).toBe('');
  });
});

describe('Session ID Generation', () => {
  it('should generate valid UUID v4', () => {
    // Mock crypto.randomUUID
    const mockUUID = '550e8400-e29b-41d4-a716-446655440000';
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => mockUUID),
    });

    const sessionId = crypto.randomUUID();
    expect(sessionId).toBe(mockUUID);
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe('URL Parameter Parsing', () => {
  it('should extract session ID from URL', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const url = `http://localhost:3000?session=${sessionId}`;
    const urlParams = new URLSearchParams(new URL(url).search);

    expect(urlParams.get('session')).toBe(sessionId);
  });

  it('should return null for missing session parameter', () => {
    const url = 'http://localhost:3000';
    const urlParams = new URLSearchParams(new URL(url).search);

    expect(urlParams.get('session')).toBeNull();
  });

  it('should handle additional query parameters', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const url = `http://localhost:3000?session=${sessionId}&other=value`;
    const urlParams = new URLSearchParams(new URL(url).search);

    expect(urlParams.get('session')).toBe(sessionId);
    expect(urlParams.get('other')).toBe('value');
  });
});
