// Story-Formular (Sheet #story-form): Datum, Fotos, Text, Sprachnotiz, Song, Freigabe.
import { openOverlay, closeOverlay } from './anim.js?v=2';
import { t, getLang } from './i18n.js?v=20';
import { showToast } from './ui.js?v=54';
import { toJpegBlob } from './image.js?v=2';
import { blobUrl } from './storage.js?v=2';
import { LIMITS, storyPaths, validateDraft } from './story-logic.js?v=1';
import { saveStoryWithMedia } from './story-save.js?v=6';
import { isOnline } from './net-status.js?v=1';
import { searchSongs, safeCover } from './songs.js?v=2';
import { canRecord, createRecorder, createPlayer } from './voice.js?v=1';

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

let state = null; // { uid, city, story, onSaved, photos: [{ path?, blob?, url }], voice, song, saving, busy,
//                 canVoice, rec, seconds, player, voiceUrl, playing, songTimer, songSeq }

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
  if (state.busy) {
    const tile = document.createElement('div');
    tile.className = 'story-photo story-photo-loading';
    tile.setAttribute('role', 'status');
    tile.setAttribute('aria-label', t('story.convertingPhotos'));
    strip.insertBefore(tile, $('story-photo-add'));
  }
  $('story-photo-add').hidden = state.busy || state.photos.length >= LIMITS.photos;
}

const mmss = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

function voiceButton(text, label, onclick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `story-voice-btn ${cls}`.trim();
  b.textContent = text;
  if (label) b.setAttribute('aria-label', label);
  b.onclick = onclick;
  return b;
}

// Spielt nichts mehr ab und gibt Objekt-URL der neuen Aufnahme frei
function releaseVoice(s) {
  s.player?.stop();
  s.player = null;
  if (s.voice?.blob && s.voiceUrl) URL.revokeObjectURL(s.voiceUrl);
  s.voiceUrl = null;
  s.playing = false;
}

function setVoice(s, voice) {
  releaseVoice(s);
  s.voice = voice;
  const ready = url => {
    if (state !== s || s.voice !== voice) return;
    s.voiceUrl = url;
    s.player = createPlayer(url, playing => { s.playing = playing; renderVoice(); });
    renderVoice();
  };
  if (voice?.blob) ready(URL.createObjectURL(voice.blob));
  else if (voice) blobUrl(voice.path).then(ready).catch(() => {});
  renderVoice();
}

function renderVoice() {
  const s = state;
  if (!s) return; // Player meldet nach dem Schliessen noch pause
  const row = $('story-voice-row');
  row.hidden = !s.canVoice;
  const label = document.createElement('span');
  label.className = 'story-row-label';
  label.textContent = t('voice.title');
  const ctl = document.createElement('div');
  ctl.className = 'story-voice-ctl';
  if (s.rec) {
    const time = document.createElement('span');
    time.className = 'story-voice-time recording';
    time.textContent = mmss(s.seconds);
    ctl.append(time, voiceButton(t('voice.stop'), '', () => stopRecording(s)));
  } else if (s.voice) {
    const play = voiceButton(s.playing ? '❚❚' : '▶', t(s.playing ? 'voice.pause' : 'voice.play'), () => s.player?.toggle(), 'round');
    play.disabled = !s.player;
    const time = document.createElement('span');
    time.className = 'story-voice-time';
    time.textContent = mmss(s.voice.seconds);
    ctl.append(play, time, voiceButton('✕', t('voice.discard'), () => { if (!s.saving) setVoice(s, null); }, 'round'));
  } else {
    ctl.append(voiceButton(t('voice.record'), '', () => startRecording(s)));
  }
  row.replaceChildren(label, ctl);
}

async function startRecording(s) {
  if (s.saving || s.rec) return;
  const rec = createRecorder({
    onTick: n => {
      if (state !== s || s.rec !== rec) return;
      s.seconds = n;
      renderVoice();
      if (n >= LIMITS.voiceSeconds) stopRecording(s);
    }
  });
  s.rec = rec;
  s.seconds = 0;
  s.player?.stop();
  renderVoice();
  try {
    await rec.start();
  } catch (e) {
    if (state !== s || s.rec !== rec) return;
    s.rec = null;
    if (e.message === 'mic-denied') showToast(t('voice.denied'));
    else s.canVoice = false;
    renderVoice();
    return;
  }
  // Formular wurde waehrend der Mikrofonfreigabe geschlossen
  if (state !== s || s.rec !== rec) rec.cancel();
}

async function stopRecording(s) {
  const rec = s.rec;
  if (!rec) return;
  s.rec = null;
  try {
    const { blob, seconds } = await rec.stop();
    if (state !== s) return;
    if (blob.size) setVoice(s, { blob, seconds });
  } catch {
    if (state === s) showToast(t('voice.failed'));
  }
  if (state === s) renderVoice();
}

const songCover = url => {
  const img = document.createElement('img');
  img.className = 'story-song-cover';
  img.alt = '';
  const src = safeCover(url);
  if (src) img.src = src;
  return img;
};

function songLines(song) {
  const box = document.createElement('span');
  box.className = 'story-song-text';
  const title = document.createElement('span');
  title.className = 'story-song-title';
  title.textContent = song.title;
  const artist = document.createElement('span');
  artist.className = 'story-song-artist';
  artist.textContent = song.artist;
  box.append(title, artist);
  return box;
}

function pickSong(s, song) {
  s.song = { id: String(song.id ?? ''), title: String(song.title ?? ''), artist: String(song.artist ?? ''), cover_url: String(song.cover_url ?? '') };
  renderSong();
}

// Suchfeld (oder Chip) bauen; das Eingabefeld bleibt beim Tippen bestehen, nur die Trefferliste wechselt
function renderSong() {
  const s = state;
  const row = $('story-song-row');
  clearTimeout(s.songTimer);
  s.songSeq++;
  const label = document.createElement('span');
  label.className = 'story-row-label';
  label.textContent = t('song.title');
  if (s.song) {
    const chip = document.createElement('div');
    chip.className = 'story-song-chip';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'story-song-remove';
    x.textContent = '✕';
    x.setAttribute('aria-label', t('song.remove'));
    x.onclick = () => { if (!s.saving) { s.song = null; renderSong(); } };
    chip.append(songCover(s.song.cover_url), songLines(s.song), x);
    row.replaceChildren(label, chip);
    return;
  }
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'story-song-input';
  input.placeholder = t('song.search');
  input.maxLength = 100;
  const list = document.createElement('div');
  list.className = 'story-song-list';
  const note = text => {
    const p = document.createElement('p');
    p.className = 'story-song-note';
    p.textContent = text;
    list.replaceChildren(p);
  };
  async function run() {
    const q = input.value.trim();
    const seq = ++s.songSeq;
    if (!q) { list.replaceChildren(); return; }
    let songs;
    try {
      if (!isOnline()) throw new Error('offline');
      songs = await searchSongs(q);
    } catch {
      if (state === s && s.songSeq === seq) note(t('song.searchFailed'));
      return;
    }
    if (state !== s || s.songSeq !== seq) return; // neuere Suche oder Formular zu
    if (!songs.length) { note(t('song.noResults')); return; }
    list.replaceChildren(...songs.map(song => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'story-song-item';
      b.append(songCover(song.cover_url), songLines(song));
      b.onclick = () => pickSong(s, song);
      return b;
    }));
  }
  input.addEventListener('input', () => {
    clearTimeout(s.songTimer);
    s.songSeq++; // laufende Suche verwerfen
    s.songTimer = setTimeout(run, 300);
  });
  row.replaceChildren(label, input, list);
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
  $('story-save').disabled = true; // Speichern erst, wenn alle Fotos umgewandelt sind
  renderPhotos();
  let tooMany = false, notImage = false, tooLarge = false, failed = false;
  for (const file of files) {
    if (s.photos.length >= LIMITS.photos) { tooMany = true; break; }
    try {
      const blob = await toJpegBlob(file, { max: 1600 });
      if (state !== s) return; // Formular wurde waehrenddessen geschlossen
      s.photos.push({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      if (e?.message === 'not-an-image') notImage = true;
      else if (e?.message === 'too-large') tooLarge = true;
      else failed = true;
    }
  }
  if (state !== s) return;
  s.busy = false;
  $('story-save').disabled = false;
  renderPhotos();
  if (tooMany) showToast(t('story.tooManyPhotos'));
  if (notImage) showToast(t('toast.notAnImage'));
  else if (tooLarge) showToast(t('toast.imageTooLarge'));
  else if (failed) showToast(t('toast.imageFailed'));
}

function close() {
  if (state?.saving) return; // laufendes Speichern nicht abbrechen
  const sheet = $('story-form');
  const s = state;
  state = null;
  s?.photos.forEach(releasePhoto);
  if (s) { s.rec?.cancel(); releaseVoice(s); clearTimeout(s.songTimer); }
  closeOverlay(sheet);
}

async function save() {
  if (state.saving || state.busy) return;
  const s = state;
  if (s.rec) {
    s.busy = true;
    await stopRecording(s);
    if (state !== s) return;
    s.busy = false;
  }
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
  if (!isOnline() && hasMedia) { showToast(t('story.needsConnection')); return; }

  const btn = $('story-save');
  s.saving = true;
  btn.disabled = true;
  $('story-cancel').disabled = $('story-grabber').disabled = true;
  btn.textContent = t('story.saving');
  try {
    // Loest nach den Uploads auf, ohne auf die Server-Bestaetigung zu warten
    const id = await saveStoryWithMedia(s.uid, draft, {
      existing: s.story, onWriteError: e => { console.error('[TM] story write rejected', e?.code ?? e); showToast(t('story.saveFailed')); }
    });
    if (state !== s) return;
    s.saving = false;
    close();
    s.onSaved?.(id);
  } catch (e) {
    console.error('[TM] story save failed', e?.code ?? e);
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
  if (state) {
    state.photos.forEach(releasePhoto);
    state.rec?.cancel();
    releaseVoice(state);
    clearTimeout(state.songTimer);
  }
  state = {
    uid, city, story, onSaved, saving: false, busy: false,
    photos: (story?.photos ?? []).map(p => ({ path: p.path, url: '' })),
    voice: null, song: story?.song ?? null, canVoice: canRecord(), rec: null, seconds: 0, songSeq: 0
  };
  renderSong();
  setVoice(state, story?.voice ?? null);
  $('story-form-title').textContent = t(story ? 'story.edit' : 'story.new');
  // Laendercode als Name anzeigen ("PT" -> "Portugal"), wie in der Orte-Liste
  let country = city.country;
  if (/^[A-Z]{2}$/.test(country ?? '')) {
    try { country = new Intl.DisplayNames([getLang()], { type: 'region' }).of(country) ?? country; } catch { /* alte WebView */ }
  }
  $('story-city').textContent = [city.name, country].filter(Boolean).join(', ');
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
