// Tab-Leiste unten und ihre Sheets (Orte, Freunde, Profil, Neue Story).
// 'map' heisst: kein Sheet offen. Die Inhalte fuellen ui.js, settings.js und app.js.
import { openOverlay, closeOverlay } from './anim.js?v=2';

const PANELS = { places: 'panel-places', friends: 'panel-friends', profile: 'panel-profile', story: 'panel-story-start' };
const SWIPE_CLOSE_PX = 80;

/** onAdd(): Plus-Knopf. onPlace(cityName): Tipp auf eine Zeile im Orte-Sheet. */
export function initHub({ onAdd, onPlace }) {
  document.querySelectorAll('#hub .hub-tab').forEach(tab =>
    tab.addEventListener('click', () => openPanel(tab.dataset.panel)));
  document.getElementById('hub-add')?.addEventListener('click', () => onAdd?.());
  document.getElementById('user-pill')?.addEventListener('click', () => openPanel('profile'));

  document.getElementById('places-list')?.addEventListener('click', e => {
    const row = e.target.closest('.place-row');
    if (!row) return;
    closePanel();
    onPlace?.(row.dataset.name);
  });

  for (const id of Object.values(PANELS)) {
    const sheet = document.getElementById(id);
    if (!sheet) continue;
    // Tipp neben das Sheet, also auf die Karte, oder auf den Griff schliesst
    sheet.addEventListener('click', e => {
      if (e.target === sheet || e.target.closest('.sheet-grabber, .sheet-close')) closePanel();
    });
    _swipeToClose(sheet.firstElementChild);
  }

  // Freunde-Sheet: Freunde oder Gruppen, die Wahl bleibt bis zum Neustart
  const tabs = document.querySelectorAll('.friends-tabs [role="tab"]');
  tabs.forEach(tab => tab.addEventListener('click', () => tabs.forEach(t => {
    const on = t === tab;
    t.classList.toggle('selected', on);
    t.setAttribute('aria-selected', String(on));
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  })));
}

export function openPanel(name) {
  const target = PANELS[name] ? name : 'map';
  document.querySelectorAll('#hub .hub-tab').forEach(tab => {
    if (tab.dataset.panel === target) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  const switching = target !== 'map';
  // Offenes Sheet: Tab-Leiste und Statistik weg, das Sheet reicht bis unten
  document.body.classList.toggle('panel-open', switching);
  for (const [key, id] of Object.entries(PANELS)) {
    const sheet = document.getElementById(id);
    if (!sheet) continue;
    if (key === target) {
      if (!sheet.classList.contains('open')) openOverlay(sheet);
    } else if (sheet.classList.contains('open')) {
      // Beim Wechsel zwischen Sheets sofort tauschen, damit genau eins offen ist
      if (switching) sheet.classList.remove('open');
      else closeOverlay(sheet, () => { sheet.firstElementChild.style.transform = ''; });
    }
  }
}

export function closePanel() {
  openPanel('map');
}

// Sheet nach unten ziehen schliesst es, aber nur wenn der Inhalt oben steht,
// sonst gehoert die Geste dem Scrollen.
function _swipeToClose(card) {
  if (!card) return;
  let startY = null;
  let dy = 0;
  card.addEventListener('touchstart', e => {
    startY = card.scrollTop <= 0 ? e.touches[0].clientY : null;
    dy = 0;
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    if (startY === null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    card.style.transform = dy ? `translateY(${dy}px)` : '';
  }, { passive: true });
  const end = () => {
    if (startY === null) return;
    startY = null;
    if (dy > SWIPE_CLOSE_PX) closePanel();
    else card.style.transform = '';
  };
  card.addEventListener('touchend', end);
  card.addEventListener('touchcancel', end);
}
