// Reine Blaetter-Logik fuer den Story-Viewer (kein DOM).
import { storyPages } from './story-logic.js?v=1';

// pos = { story, page } (Indizes). Ueber das Ende hinaus null, vor dem Anfang bleibt die erste Seite.
export function step(pos, stories, dir) {
  const count = i => storyPages(stories[i]).length;
  if (dir > 0) {
    if (pos.page + 1 < count(pos.story)) return { story: pos.story, page: pos.page + 1 };
    return pos.story + 1 < stories.length ? { story: pos.story + 1, page: 0 } : null;
  }
  if (pos.page > 0) return { story: pos.story, page: pos.page - 1 };
  if (pos.story > 0) return { story: pos.story - 1, page: count(pos.story - 1) - 1 };
  return { story: 0, page: 0 };
}
