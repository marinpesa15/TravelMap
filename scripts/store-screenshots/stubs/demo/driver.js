// Oeffnet den Zustand aus demo-state.js, sobald die Karte steht.
// Die ?v=-Versionen muessen denen in js/app.js gleichen, sonst laedt das Modul
// ein zweites Mal; shoot.sh gleicht sie beim Kopieren an.
import { getMap } from '../js/map.js?v=30';
import { openPanel } from '../js/hub.js?v=2';
import { openStoryViewer } from '../js/story-viewer.js?v=8';
import { openStoryForm } from '../js/story-form.js?v=11';
import { t } from '../js/i18n.js?v=20';
import { UID, STORIES, LISBON_STORY_ID, DRAFT } from './demo-data.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);

async function ready() {
  for (;;) {
    const map = getMap();
    // Die Safe-Area kommt im Simulator manchmal erst spaet an, dann steht die Suche unter der Statusleiste
    const barTop = document.querySelector('.top-right-bar')?.getBoundingClientRect().top ?? 0;
    if (!$('app-splash') && map?.loaded() && $('stat-cities-num')?.textContent !== '0' && barTop > 40) return map;
    await sleep(200);
  }
}

const { default: state } = await import(`./demo-state.js?t=${Date.now()}`);
const map = await ready();
map.jumpTo({ center: [9.5, 46.5], zoom: 2.85 });
await new Promise(r => map.once('idle', r));
await sleep(1000);

// Demo-Cover: die App nimmt nur Spotify-Cover (safeCover), hier ein lokales Bild nur im DOM
const COVER = new URL('./cover.jpg', import.meta.url).href;

if (state === 'story') {
  openStoryViewer({ stories: [{ id: LISBON_STORY_ID, ...STORIES[LISBON_STORY_ID] }], own: true });
  const pill = document.querySelector('#viewer-song .viewer-song-pill');
  if (pill && !pill.querySelector('img')) {
    const img = document.createElement('img');
    img.className = 'viewer-song-cover';
    img.alt = '';
    img.src = COVER;
    pill.prepend(img);
  }
} else if (state === 'formular') {
  openStoryForm({ uid: UID, city: DRAFT.city, story: DRAFT.story });
  $('story-form-title').textContent = t('story.new');
  document.querySelector('#story-song-row .story-song-cover')?.setAttribute('src', COVER);
} else if (state === 'orte') {
  openPanel('places');
} else if (state === 'laender') {
  $('tab-countries').click();
} else if (state === 'freunde') {
  openPanel('friends');
}
document.body.dataset.demoState = state;
