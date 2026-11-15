// Erfundene Demo-Daten fuer die App-Store-Screenshots. Keine echten Personen,
// keine echten Fotos ausser den drei KI-generierten Lissabon-Bildern.
// Koordinaten aus data/places.json (GeoNames), Namen wie die deutsche Suche sie liefert.
export const UID = 'demo-lena';

export const USER = {
  uid: UID,
  displayName: 'Lena Hoffmann',
  email: 'lena.hoffmann@example.com',
  photoURL: '',
  providerData: [{ providerId: 'apple.com', email: 'lena.hoffmann@example.com' }]
};

const c = (name, lat, lng, country, lived = false) => ({ name, lat, lng, country, lived });

const visited = [
  c('Lissabon', 38.7251, -9.1498, 'PT'),
  c('Porto', 41.1485, -8.611, 'PT'),
  c('Madrid', 40.4165, -3.7026, 'ES'),
  c('Barcelona', 41.3888, 2.159, 'ES'),
  c('Sevilla', 37.3828, -5.9732, 'ES'),
  c('Paris', 48.8534, 2.3488, 'FR'),
  c('Lyon', 45.7491, 4.8479, 'FR'),
  c('Amsterdam', 52.374, 4.8897, 'NL'),
  c('Brüssel', 50.8505, 4.3488, 'BE'),
  c('London', 51.5085, -0.1257, 'GB'),
  c('Dublin', 53.3331, -6.2489, 'IE'),
  c('Berlin', 52.5244, 13.4105, 'DE', true),
  c('Hamburg', 53.5507, 9.993, 'DE'),
  c('München', 48.1374, 11.5755, 'DE', true),
  c('Köln', 50.9333, 6.95, 'DE'),
  c('Wien', 48.2085, 16.3721, 'AT'),
  c('Zürich', 47.3667, 8.55, 'CH'),
  c('Prag', 50.088, 14.4208, 'CZ'),
  c('Kopenhagen', 55.6759, 12.5655, 'DK'),
  c('Stockholm', 59.3294, 18.0687, 'SE'),
  c('Rom', 41.8919, 12.5113, 'IT'),
  c('Florenz', 43.7793, 11.2463, 'IT'),
  c('Venedig', 45.4371, 12.3326, 'IT'),
  c('Athen', 37.9838, 23.7278, 'GR'),
  c('Budapest', 47.4984, 19.0405, 'HU'),
  c('Krakau', 50.0614, 19.9366, 'PL'),
  c('Split', 43.5089, 16.4392, 'HR'),
  c('Istanbul', 41.0138, 28.9497, 'TR'),
  c('New York City', 40.7143, -74.006, 'US'),
  c('Bangkok', 13.754, 100.5014, 'TH')
];

const wishlist = [
  c('Reykjavík', 64.1355, -21.8954, 'IS'),
  c('Edinburgh', 55.9521, -3.1965, 'GB'),
  c('Oslo', 59.9127, 10.7461, 'NO'),
  c('Helsinki', 60.1695, 24.9355, 'FI'),
  c('Neapel', 40.8522, 14.2681, 'IT'),
  c('Marrakesch', 31.6342, -7.9999, 'MA'),
  c('Tokio', 35.6895, 139.6917, 'JP'),
  c('Kapstadt', -33.9258, 18.4232, 'ZA')
].map(({ lived, ...rest }) => rest);

const day = s => new Date(`${s}T12:00:00`).getTime();
const storyPath = (id, file) => `users/${UID}/stories/${id}/${file}`;

export const LISBON_STORY_ID = 'story-lissabon';

const SONG = { id: 'demo-song', title: 'Saudade am Tejo', artist: 'Mareike & die Möwen', cover_url: '' };

export const STORIES = {
  [LISBON_STORY_ID]: {
    city: 'Lissabon', country: 'PT', date: day('2026-09-14'),
    text: 'Mit der Tram 28 hoch nach Alfama, oben am Miradouro den Sonnenuntergang über dem Tejo angeschaut. Danach Pastéis de Nata, viel zu viele.',
    photos: ['p0.jpg', 'p1.jpg', 'p2.jpg'].map(f => ({ path: storyPath(LISBON_STORY_ID, f) })),
    voice: { path: storyPath(LISBON_STORY_ID, 'voice.m4a'), seconds: 24 },
    song: SONG, shared: true, created_at: day('2026-09-15')
  },
  'story-barcelona': {
    city: 'Barcelona', country: 'ES', date: day('2026-06-02'),
    text: 'Bunker del Carmel zum Sonnenaufgang, danach Churros im Gràcia-Viertel.',
    shared: true, created_at: day('2026-06-03')
  },
  'story-paris': {
    city: 'Paris', country: 'FR', date: day('2025-12-28'),
    text: 'Silvester-Wochenende mit Mira. Montmartre im Nebel, Crêpes an jeder Ecke.',
    shared: true, created_at: day('2025-12-29')
  },
  'story-rom': {
    city: 'Rom', country: 'IT', date: day('2025-04-19'),
    text: 'Zu Fuß von Trastevere bis zum Kolosseum, abends Cacio e Pepe.',
    shared: false, created_at: day('2025-04-20')
  },
  'story-kopenhagen': {
    city: 'Kopenhagen', country: 'DK', date: day('2025-08-09'),
    text: 'Mit dem Rad durch Nørrebro, Sprung ins Hafenbad.',
    shared: true, created_at: day('2025-08-10')
  },
  'story-wien': {
    city: 'Wien', country: 'AT', date: day('2024-11-30'),
    text: 'Christkindlmarkt am Rathausplatz und Kaffeehaus bis spät.',
    shared: true, created_at: day('2024-12-01')
  },
  'story-athen': {
    city: 'Athen', country: 'GR', date: day('2024-07-05'),
    text: 'Akropolis um acht Uhr morgens, noch fast allein dort.',
    shared: false, created_at: day('2024-07-06')
  }
};

// Entwurf fuer den Formular-Screenshot: eine neue Story zu Porto
export const DRAFT = {
  city: visited[1],
  story: {
    city: 'Porto', country: 'PT', date: day('2026-09-18'),
    text: 'Mit Elif am Douro entlang bis Foz, Francesinha zum Abendessen.',
    photos: ['p0.jpg', 'p1.jpg', 'p2.jpg'].map(f => ({ path: storyPath('draft', f) })),
    voice: { path: storyPath('draft', 'voice.m4a'), seconds: 24 },
    song: SONG, shared: true
  }
};

// Storage-Pfad -> Datei unter public/demo/
export function mediaFile(path) {
  const file = path.split('/').pop();
  return { 'p0.jpg': 'a.jpg', 'p1.jpg': 'b.jpg', 'p2.jpg': 'c.jpg' }[file] ?? null;
}

const FRIENDS = {
  'demo-jonas': { display_name: 'Jonas Becker', avatar_url: '', since: day('2025-03-02') },
  'demo-mira':  { display_name: 'Mira Okafor',  avatar_url: '', since: day('2025-06-11') },
  'demo-elif':  { display_name: 'Elif Demir',   avatar_url: '', since: day('2026-01-20') }
};

// Firestore-Dokumente nach Pfad
export function initialDocs() {
  const docs = {
    [`users/${UID}`]: {
      display_name: USER.displayName,
      avatar_url: '',
      invite_token: 'demo-invite-token',
      consent: { version: 2, accepted_at: day('2026-11-01') },
      visited_cities: visited,
      wishlist_cities: wishlist,
      visited_countries: ['PT', 'ES', 'FR', 'NL', 'BE', 'GB', 'IE', 'DE', 'AT', 'CH', 'CZ', 'DK', 'SE', 'IT', 'GR', 'HU', 'PL', 'HR', 'TR', 'US', 'TH'],
      wishlist_countries: ['IS', 'NO', 'FI', 'MA', 'JP', 'ZA', 'AR']
    },
    'invites/demo-invite-token': { uid: UID, display_name: USER.displayName, avatar_url: '' },
    'groups/demo-group-interrail': {
      name: 'Interrail Sommer', created_by: UID, created_at: day('2026-05-01'),
      members: [UID, 'demo-jonas', 'demo-mira'], visited_cities: [], wishlist_cities: []
    },
    'groups/demo-group-wg': {
      name: 'WG Leipzig', created_by: 'demo-elif', created_at: day('2025-10-12'),
      members: ['demo-elif', UID, 'demo-jonas', 'demo-mira'], visited_cities: [], wishlist_cities: []
    }
  };
  for (const [fid, f] of Object.entries(FRIENDS)) docs[`users/${UID}/friends/${fid}`] = f;
  for (const [sid, s] of Object.entries(STORIES)) docs[`users/${UID}/stories/${sid}`] = s;
  return docs;
}
