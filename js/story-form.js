// Story-Formular (Sheet #story-form): Datum, Fotos, Text, Freigabe. Die Zeilen
// #story-voice-row und #story-song-row sind Platz fuer Sprachnotiz und Song.
import { openOverlay, closeOverlay } from './anim.js?v=2';
import { t } from './i18n.js?v=13';
import { showToast } from './ui.js?v=49';
import { toJpegBlob } from './image.js?v=1';
import { blobUrl } from './storage.js?v=1';
import { LIMITS, storyPaths, validateDraft } from './story-logic.js?v=1';
import { saveStoryWithMedia } from './story-save.js?v=2';
import { settleWrite } from './offline-write.js?v=1';
import { isOnline } from './net-status.js?v=1';

const $ = id => document.getElementById(id);
const COUNTER_FROM = 1800;

// Datum als Mittag lokaler Zeit (Millisekunden), damit Zeitzonen den Tag nicht verschieben
const dateToMillis = value => (value ? new Date(`${value}T12:00:00`).getTime() : null);
function millisToDate(x) {
  if (x == null) return '';
  const d = new Date(x.toMillis?.() ?? Number(x));
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let state = null; // { uid, city, story, onSaved, photos: [{ path?, blob?, url }], voice, song, saving, busy }

function releasePhoto(p) {
  if (p.blob) URL.revokeObjectURL(p.url);
}

function renderPhotos() {
  const strip = $('story-photos');
  strip.querySelectorAll('.story-photo').forEach(el => el.remove());
  state.photos.forEach((p, i) => {
    const tile = document.createElement('div');
    tile.className = 'story-photo';
    if (p.url) tile.style.backgroundImage = `url("${p.url}")`;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'story-photo-remove';
    x.textContent = '✕';
    x.setAttribute('aria-label', t('story.removePhoto'));
    x.onclick = () => {
      releasePhoto(p);
      state.photos.splice(i, 1);
      renderPhotos();
    };
    tile.appendChild(x);
    strip.insertBefore(tile, $('story-photo-add'));
  });
  $('story-photo-add').hidden = state.photos.length >= LIMITS.photos;
}

function updateCounter() {
  const n = $('story-text').value.length;
  const el = $('story-counter');
  el.hidden = n < COUNTER_FROM;
  el.textContent = `${n} / ${LIMITS.textChars}`;
}

async function addFiles(files) {
  const s = state;
  s.busy = true;
  let tooMany = false, notImage = false, failed = false;
  for (const file of files) {
    if (s.photos.length >= LIMITS.photos) { tooMany = true; break; }
    try {
      const blob = await toJpegBlob(file, { max: 1600 });
      if (state !== s) return; // Formular wurde waehrenddessen geschlossen
      s.photos.push({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      if (e?.message === 'not-an-image') notImage = true; else failed = true;
    }
  }
  if (state !== s) return;
  s.busy = false;
  renderPhotos();
  if (tooMany) showToast(t('story.tooManyPhotos'));
  if (notImage) showToast(t('toast.notAnImage'));
  else if (failed) showToast(t('toast.imageFailed'));
}

function close() {
  if (state?.saving) return; // laufendes Speichern nicht abbrechen
  const sheet = $('story-form');
  const s = state;
  state = null;
  s?.photos.forEach(releasePhoto);
  closeOverlay(sheet);
}

async function save() {
  if (state.saving || state.busy) return;
  const s = state;
  const draft = {
    city: s.city.name, country: s.city.country ?? '',
    date: dateToMillis($('story-date').value),
    text: $('story-text').value.trim(),
    photos: s.photos.map(p => (p.blob ? { blob: p.blob } : { path: p.path })),
    voice: s.voice, song: s.song,
    shared: $('story-shared').checked
  };
  const invalid = validateDraft(draft);
  if (invalid) { showToast(t(invalid === 'empty' ? 'story.empty' : 'story.saveFailed')); return; }
  const hasMedia = draft.photos.length || draft.voice || (s.story && storyPaths(s.story).length);
  const online = isOnline();
  if (!online && hasMedia) { showToast(t('story.needsConnection')); return; }

  const btn = $('story-save');
  s.saving = true;
  btn.disabled = true;
  $('story-cancel').disabled = $('story-grabber').disabled = true;
  btn.textContent = t('story.saving');
  try {
    // Offline wartet saveStory ewig auf den Server, der lokale Stand ist aber sofort da
    const id = await settleWrite(
      saveStoryWithMedia(s.uid, draft, { existing: s.story }),
      { online, onError: () => showToast(t('story.saveFailed')) }
    );
    if (state !== s) return;
    s.saving = false;
    close();
    s.onSaved?.(id);
  } catch (e) {
    if (state !== s) return;
    showToast(t('story.saveFailed'));
    s.saving = false;
    $('story-cancel').disabled = $('story-grabber').disabled = false;
    btn.disabled = false;
    btn.textContent = t('story.save');
  }
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  $('story-grabber').onclick = close;
  $('story-cancel').onclick = close;
  $('story-save').onclick = save;
  $('story-text').addEventListener('input', updateCounter);
  $('story-photo-input').addEventListener('change', e => {
    const files = [...e.target.files];
    e.target.value = ''; // dieselbe Datei darf erneut gewaehlt werden
    if (files.length && state) addFiles(files);
  });
}

/** Oeffnet das Formular fuer eine neue (story = null) oder bestehende Story. */
export function openStoryForm({ uid, city, story = null, onSaved }) {
  wire();
  if (state) state.photos.forEach(releasePhoto);
  state = {
    uid, city, story, onSaved, saving: false, busy: false,
    photos: (story?.photos ?? []).map(p => ({ path: p.path, url: '' })),
    voice: story?.voice ?? null, song: story?.song ?? null
  };
  $('story-form-title').textContent = t(story ? 'story.edit' : 'story.new');
  $('story-city').textContent = [city.name, city.country].filter(Boolean).join(', ');
  $('story-date').value = millisToDate(story?.date);
  $('story-text').value = story?.text ?? '';
  $('story-shared').checked = !!story?.shared;
  const btn = $('story-save');
  btn.disabled = false;
  $('story-cancel').disabled = $('story-grabber').disabled = false;
  btn.textContent = t('story.save');
  updateCounter();
  renderPhotos();
  // Vorschau gespeicherter Fotos nachladen
  const current = state;
  current.photos.forEach(p => blobUrl(p.path).then(url => {
    if (state === current) { p.url = url; renderPhotos(); }
  }).catch(() => {}));
  openOverlay($('story-form'));
}
