export default async function handler(request, response) {
  const path = Array.isArray(request.query.path) ? request.query.path.join('/') : request.query.path
  const search = new URLSearchParams(Object.entries(request.query).filter(([key]) => key !== 'path')).toString()
  const upstream = await fetch(`https://api.tcgdex.net/v2/${path}${search ? `?${search}` : ''}`)
  response.status(upstream.status)
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  response.setHeader('Content-Type', 'application/json')
  response.send(await upstream.text())
}
