const CACHE = 'pokearchivo-api-v1'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isCatalog = url.hostname === 'api.pokemontcg.io' && url.pathname.startsWith('/v2/')
  if (!isCatalog || event.request.method !== 'GET') return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || fresh
    }),
  )
})
