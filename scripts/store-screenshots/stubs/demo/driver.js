// Oeffnet den Zustand aus demo-state.js, sobald die Karte steht.
import { getMap } from '../js/map.js?v=30';
import { openPanel } from '../js/hub.js?v=2';
import { openStoryViewer } from '../js/story-viewer.js?v=7';
import { openStoryForm } from '../js/story-form.js?v=10';
import { t } from '../js/i18n.js?v=20';
import { UID, STORIES, LISBON_STORY_ID, DRAFT } from './demo-data.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);

async function ready() {
  for (;;) {
    const map = getMap();
    if (!$('app-splash') && map?.loaded() && $('stat-cities-num')?.textContent !== '0') return map;
    await sleep(200);
  }
}

const { default: state } = await import(`./demo-state.js?t=${Date.now()}`);
const map = await ready();
map.jumpTo({ center: [9.5, 46.5], zoom: 2.85 });
await new Promise(r => map.once('idle', r));
await sleep(1000);

if (state === 'story') {
  openStoryViewer({ stories: [{ id: LISBON_STORY_ID, ...STORIES[LISBON_STORY_ID] }], own: true });
} else if (state === 'formular') {
  openStoryForm({ uid: UID, city: DRAFT.city, story: DRAFT.story });
  $('story-form-title').textContent = t('story.new');
} else if (state === 'orte') {
  openPanel('places');
} else if (state === 'laender') {
  $('tab-countries').click();
} else if (state === 'freunde') {
  openPanel('friends');
}
document.body.dataset.demoState = state;
