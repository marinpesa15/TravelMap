import { describe, it, expect, vi } from 'vitest';
import { isBundledLegalHref, installLegalViewer } from '../js/legal-view.js';

// In the native shell a target="_blank" link is handed to iOS as
// capacitor://localhost/privacy.html, which nothing can open (LaunchServices
// error 115). The viewer intercepts those clicks and shows the bundled page
// inside the app. In the browser nothing changes.

function fakeDoc() {
  const listeners = {};
  return {
    listeners,
    addEventListener: (type, fn) => { listeners[type] = fn; }
  };
}

function click(href) {
  const anchor = { getAttribute: () => href };
  return {
    anchor,
    event: { target: { closest: () => anchor }, preventDefault: vi.fn() }
  };
}

describe('isBundledLegalHref', () => {
  it('matches the relative legal pages with and without anchors', () => {
    expect(isBundledLegalHref('privacy.html')).toBe(true);
    expect(isBundledLegalHref('privacy.html#privacy')).toBe(true);
    expect(isBundledLegalHref('privacy.html#imprint')).toBe(true);
    expect(isBundledLegalHref('support.html')).toBe(true);
  });

  it('leaves everything else alone', () => {
    expect(isBundledLegalHref('map.html')).toBe(false);
    expect(isBundledLegalHref('https://travel.marinpesa.dev/privacy.html')).toBe(false);
    expect(isBundledLegalHref('mailto:pesamarin81@gmail.com')).toBe(false);
    expect(isBundledLegalHref(null)).toBe(false);
  });
});

describe('installLegalViewer', () => {
  it('does nothing in the browser', () => {
    const doc = fakeDoc();
    const open = vi.fn();
    expect(installLegalViewer({ doc, native: false, open })).toBe(false);
    expect(doc.listeners.click).toBeUndefined();
  });

  it('opens bundled legal links in the viewer when native', () => {
    const doc = fakeDoc();
    const open = vi.fn();
    expect(installLegalViewer({ doc, native: true, open })).toBe(true);
    const { event } = click('privacy.html#imprint');
    doc.listeners.click(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('privacy.html#imprint');
  });

  it('lets other links through untouched when native', () => {
    const doc = fakeDoc();
    const open = vi.fn();
    installLegalViewer({ doc, native: true, open });
    const { event } = click('mailto:pesamarin81@gmail.com');
    doc.listeners.click(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    const noAnchor = { target: { closest: () => null }, preventDefault: vi.fn() };
    doc.listeners.click(noAnchor);
    expect(noAnchor.preventDefault).not.toHaveBeenCalled();
  });
});
