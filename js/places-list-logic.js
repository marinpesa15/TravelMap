// Liste fuer das Orte-Sheet (js/ui.js renderPlacesList). Besuchte zuerst,
// zuletzt hinzugefuegte oben, danach die Wunschliste. Im Laender-Modus stehen
// statt der Staedte die Laender (ISO-Codes) in der Liste, wie die Filter zaehlen.
// filter: 'all' | 'visited' | 'wishlist' | 'lived', mode: 'cities' | 'countries'
export function buildPlaceList(userData, filter, storyCities = new Set(), mode = 'cities') {
  const countries = mode === 'countries';
  const row = type => item => (countries
    ? { name: item, country: '', type, lived: false, hasStory: false }
    : {
      name: item.name,
      country: item.country ?? '',
      type,
      lived: !!item.lived,
      hasStory: storyCities.has(item.name)
    });
  const key = countries ? 'countries' : 'cities';
  const visited  = [...(userData?.[`visited_${key}`] ?? [])].reverse().map(row('visited'));
  const wishlist = [...(userData?.[`wishlist_${key}`] ?? [])].reverse().map(row('wishlist'));
  if (filter === 'visited')  return visited;
  if (filter === 'wishlist') return wishlist;
  if (filter === 'lived')    return visited.filter(p => p.lived);
  return [...visited, ...wishlist];
}
