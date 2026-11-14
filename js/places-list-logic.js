// Liste fuer das Orte-Sheet (js/ui.js renderPlacesList). Besuchte Staedte
// zuerst, zuletzt hinzugefuegte oben, danach die Wunschliste.
// filter: 'all' | 'visited' | 'wishlist' | 'lived'
export function buildPlaceList(userData, filter, storyCities = new Set()) {
  const row = type => city => ({
    name: city.name,
    country: city.country ?? '',
    type,
    lived: !!city.lived,
    hasStory: storyCities.has(city.name)
  });
  const visited  = [...(userData?.visited_cities ?? [])].reverse().map(row('visited'));
  const wishlist = [...(userData?.wishlist_cities ?? [])].reverse().map(row('wishlist'));
  if (filter === 'visited')  return visited;
  if (filter === 'wishlist') return wishlist;
  if (filter === 'lived')    return visited.filter(p => p.lived);
  return [...visited, ...wishlist];
}
