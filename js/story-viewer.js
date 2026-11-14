// Story-Viewer (Vollbild #story-viewer): Seiten wie eine Insta-Story, Tippen links/rechts
// blaettert, Wischen nach unten schliesst. Kein automatisches Weiterblaettern.
// #viewer-voice zeigt die Sprachnotiz-Pille, #viewer-song die Song-Pille mit Spotify-Sheet.
import { openOverlay, closeOverlay } from './anim.js?v=2';
import { t, getLang } from './i18n.js?v=18';
import { showConfirm } from './ui.js?v=51';
import { blobUrl } from './storage.js?v=1';
import { storyPages } from './story-logic.js?v=1';
import { step } from './viewer-logic.js?v=1';
import { createPlayer } from './voice.js?v=1';
import { embedUrl, openUrl, safeCover } from './songs.js?v=1';

const $ = id => document.getElementById(id);

let state = null; // { stories, pos, own, unavailable, onEdit, onDelete, onAdd, onRemoveCity }

function formatDate(x) {
  if (x == null) return '';
  return new Date(x.toMillis?.() ?? Number(x))
    .toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric' });
}

let player = null; // Wiedergabe der Sprachnotiz, endet mit Seitenwechsel und Schliessen

function stopVoice() {
  player?.stop();
  player = null;
  $('viewer-voice').replaceChildren();
}

// Pille erst zeigen, wenn die Aufnahme ladbar ist (Zugriff verweigert: keine Pille)
function renderVoice(s, story) {
  stopVoice();
  if (!story.voice?.path) return;
  const pos = s.pos;
  blobUrl(story.voice.path).then(url => {
    if (state !== s || s.pos !== pos) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'viewer-pill';
    const icon = document.createElement('span');
    const time = document.createElement('span');
    const sec = story.voice.seconds ?? 0;
    time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    btn.append(icon, time);
    const show = playing => {
      icon.textContent = playing ? '❚❚' : '▶';
      btn.setAttribute('aria-label', t(playing ? 'voice.pause' : 'voice.play'));
    };
    show(false);
    player = createPlayer(url, show);
    btn.onclick = () => player?.toggle();
    $('viewer-voice').replaceChildren(btn);
  }).catch(() => {});
}

// Sheet schliessen und iframe entfernen: ohne Tipp (oder danach) besteht keine Verbindung zu Spotify
function closeSong() {
  $('viewer-song-sheet').hidden = true;
  $('viewer-song-embed').replaceChildren();
}

function openSong(song) {
  const frame = document.createElement('iframe');
  frame.src = embedUrl(song.id);
  frame.height = '152';
  frame.allow = 'encrypted-media';
  frame.title = song.title;
  $('viewer-song-embed').replaceChildren(frame);
  $('viewer-song-open').onclick = () => window.open(openUrl(song.id), '_blank');
  $('viewer-song-sheet').hidden = false;
}

// Pille mit Cover und Titel, Daten kommen von aussen: nur textContent und https-Cover
function renderSong(story) {
  closeSong();
  const host = $('viewer-song');
  const song = story.song;
  if (!song?.id) { host.replaceChildren(); return; }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'viewer-pill viewer-song-pill';
  btn.setAttribute('aria-label', t('song.play', { title: song.title ?? '' }));
  const cover = safeCover(song.cover_url);
  if (cover) {
    const img = document.createElement('img');
    img.className = 'viewer-song-cover';
    img.alt = '';
    img.src = cover;
    btn.append(img);
  }
  const title = document.createElement('span');
  title.className = 'viewer-song-title';
  title.textContent = song.title ?? '';
  btn.append(title);
  btn.onclick = () => openSong(song);
  host.replaceChildren(btn);
}

function render() {
  const s = state;
  const story = s.stories[s.pos.story];
  const pages = storyPages(story);
  const page = pages[s.pos.page];
  s.unavailable = false;

  $('viewer-progress').replaceChildren(...pages.map((_, i) => {
    const seg = document.createElement('span');
    seg.className = i <= s.pos.page ? 'viewer-seg seen' : 'viewer-seg';
    return seg;
  }));
  $('viewer-city').textContent = story.city;
  $('viewer-date').textContent = formatDate(story.date);
  $('viewer-menu').hidden = true;
  renderVoice(s, story);
  renderSong(story);

  const img = $('viewer-photo');
  const isPhoto = page.kind === 'photo';
  $('viewer-textpage').hidden = isPhoto;
  $('viewer-textpage').textContent = isPhoto ? '' : story.text ?? '';
  $('viewer-caption').textContent = isPhoto ? story.text ?? '' : '';
  $('viewer-unavailable').hidden = true;
  img.hidden = true;
  img.removeAttribute('src');
  if (!isPhoto) return;

  const pos = s.pos;
  blobUrl(page.path).then(url => {
    if (state !== s || s.pos !== pos) return; // inzwischen weitergeblaettert
    img.src = url;
    img.hidden = false;
  }).catch(() => {
    if (state !== s || s.pos !== pos) return;
    // Story inzwischen privat oder geloescht: Hinweis statt kaputtem Bild, naechster Tipp schliesst
    s.unavailable = true;
    $('viewer-caption').textContent = '';
    $('viewer-unavailable').hidden = false;
  });
}

function go(dir) {
  if (!state) return;
  if (state.unavailable) { close(); return; }
  if (!$('viewer-menu').hidden) { $('viewer-menu').hidden = true; return; }
  const next = step(state.pos, state.stories, dir);
  if (!next) { close(); return; }
  state.pos = next;
  render();
}

function close() {
  if (!state) return;
  state = null;
  stopVoice();
  closeSong();
  closeOverlay($('story-viewer'));
}

// Menue-Aktion: Viewer schliessen, dann den Callback mit der aktuellen Story aufrufen
function act(cb) {
  const story = state?.stories[state.pos.story];
  close();
  cb?.(story);
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  $('viewer-prev').onclick = () => go(-1);
  $('viewer-next').onclick = () => go(1);
  $('viewer-close').onclick = close;
  $('viewer-song-sheet').onclick = e => { if (e.target === e.currentTarget) closeSong(); };
  $('viewer-menu-btn').onclick = () => { $('viewer-menu').hidden = !$('viewer-menu').hidden; };
  $('viewer-edit').onclick = () => act(state?.onEdit);
  $('viewer-add').onclick = () => act(state?.onAdd);
  $('viewer-remove-city').onclick = () => act(state?.onRemoveCity);
  $('viewer-delete').onclick = () => {
    const s = state;
    $('viewer-menu').hidden = true;
    showConfirm(t('story.deleteConfirm'), t('dialog.delete'), () => {
      if (state === s) act(s.onDelete);
    });
  };

  // Wischen nach unten schliesst
  const stage = $('story-viewer');
  let start = null;
  stage.addEventListener('touchstart', e => {
    const p = e.touches[0];
    start = e.touches.length === 1 ? { x: p.clientX, y: p.clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!start) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x, dy = p.clientY - start.y;
    start = null;
    if (dy > 80 && Math.abs(dx) < dy) close();
  }, { passive: true });
}

/**
 * Oeffnet den Viewer. stories in Anzeigereihenfolge (sortStories). own blendet das
 * Menue ein (Bearbeiten, Story hinzufuegen, Ort entfernen, Loeschen mit Rueckfrage).
 * Jeder Callback bekommt die gerade gezeigte Story, der Viewer ist dann schon zu.
 */
export function openStoryViewer({ stories, startIndex = 0, own, onEdit, onDelete, onAdd, onRemoveCity }) {
  if (!stories?.length) return;
  wire();
  state = {
    stories, own, onEdit, onDelete, onAdd, onRemoveCity,
    pos: { story: Math.min(startIndex, stories.length - 1), page: 0 }, unavailable: false
  };
  $('viewer-menu-btn').hidden = !own;
  render();
  openOverlay($('story-viewer'));
}
