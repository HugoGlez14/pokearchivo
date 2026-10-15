import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './Regions.css'
import './Competitive.css'
import './Decks.css'
import './Polish.css'
import './CardImage.css'

const TCG = 'https://api.pokemontcg.io/v2/'
const TCGDEX = '/api/tcgdex/'
const BACKUP = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json'
const REGIONS = ['kanto','johto','hoenn','sinnoh','unova','kalos','alola','galar','paldea']
const META = [
  { name:'Grimmsnarl Froslass', share:10.39, win:52.69, list:['4 Grimmsnarl ex','3 Froslass','4 Marnie’s Morpeko','4 Buddy-Buddy Poffin','14 Energías'] },
  { name:'Raging Bolt Ogerpon', share:8.49, win:52.43, list:['4 Raging Bolt ex','3 Teal Mask Ogerpon ex','4 Earthen Vessel','4 Professor’s Research','13 Energías'] },
  { name:'Gardevoir', share:7.53, win:50.02, list:['4 Ralts','3 Kirlia','2 Gardevoir ex','4 Rare Candy','11 Energías'] },
]
const FALLBACK_CARDS = [
  ['base1-4','Charizard','Base Set','Pokémon','120'],['base1-2','Blastoise','Base Set','Pokémon','100'],['base1-15','Venusaur','Base Set','Pokémon','100'],['base1-58','Pikachu','Base Set','Pokémon','40'],
  ['base2-4','Charizard','Jungle','Pokémon','120'],['base3-34','Gengar','Fossil','Pokémon','80'],['base4-4','Dragonite','Fossil','Pokémon','100'],['base5-1','Alakazam','Team Rocket','Pokémon','80'],
].map(([id,name,set,supertype,hp])=>({id,name,set:{name:set},supertype,hp,images:{small:`https://images.pokemontcg.io/${id.replace('-', '/')}.png`}}))
const FALLBACK_SETS = [
  ['base1','Base Set','Base',102],['base2','Jungle','Base',64],['base3','Fossil','Base',62],['base4','Base Set 2','Base',130],['base5','Team Rocket','Team Rocket',83],
  ['swsh1','Sword & Shield','Sword & Shield',216],['swsh4','Vivid Voltage','Sword & Shield',203],['swsh7','Evolving Skies','Sword & Shield',237],['swsh12pt5','Crown Zenith','Sword & Shield',230],
  ['sv1','Scarlet & Violet','Scarlet & Violet',258],['sv3','Obsidian Flames','Scarlet & Violet',230],['sv4','Paradox Rift','Scarlet & Violet',266],['sv5','Temporal Forces','Scarlet & Violet',218],['sv6','Twilight Masquerade','Scarlet & Violet',226],
].map(([id,name,series,total])=>({id,name,series,total,releaseDate:'Catálogo local'}))
const regionalFallback = region => { const ranges={kanto:[1,151],johto:[152,251],hoenn:[252,386],sinnoh:[387,493],unova:[494,649],kalos:[650,721],alola:[722,809],galar:[810,905],paldea:[906,1025]}; const [start,end]=ranges[region]; return Array.from({length:end-start+1},(_,index)=>({entry_number:index+1,pokemon_species:{name:`Pokémon ${start+index}`,url:`https://pokeapi.co/api/v2/pokemon-species/${start+index}/`}})) }
const pretty = (s) => s.replaceAll('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
const timeout = (promise, ms=6500) => Promise.race([promise, new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),ms))])
const getJson = (url) => timeout(fetch(url).then(r => r.ok ? r.json() : Promise.reject(Error(r.status))))
const tcgdexImage = image => {
  if (!image) return ''
  if (/\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i.test(image)) return image
  return `${image.replace(/\/$/, '')}/low.webp`
}

function CardImage({ card }) {
  const [failedSource, setFailedSource] = useState('')
  const source = card.images?.small

  if (!source || failedSource === source) {
    return <div className="card-image-missing" role="img" aria-label={`Imagen no disponible para ${card.name}`}><span>Imagen no disponible</span></div>
  }

  return <img loading="lazy" src={source} alt={card.name} onError={() => setFailedSource(source)}/>
}

function useSets() {
  const [sets, setSets] = useState([])
  const [notice, setNotice] = useState('Cargando expansiones…')
  useEffect(() => {
    getJson(`${TCG}sets?pageSize=250&orderBy=-releaseDate`).then(d => d.data)
      .catch(() => getJson(BACKUP))
      .then(d => { setSets([...d].sort((a,b) => (b.releaseDate||'').localeCompare(a.releaseDate||''))); setNotice('') })
      .catch(() => { setSets(FALLBACK_SETS); setNotice('Mostrando catálogo local mientras la fuente externa vuelve a estar disponible.') })
  }, [])
  return { sets, notice }
}

function Loader({ label='Consultando Pokédex…' }) { return <div className="loader"><span/><b>{label}</b></div> }

function Cards({ sets, deck, add, initialSet='' }) {
  const [query, setQuery] = useState(''), [set, setSet] = useState(initialSet), [language,setLanguage] = useState('en')
  const [cards, setCards] = useState([]), [state, setState] = useState('loading'), [page, setPage] = useState(1), [attempt,setAttempt] = useState(0)
  useEffect(() => {
    const q = [query && `name:${query}`, set && `set.id:${set}`].filter(Boolean).join(' ')
    setState('loading')
    const controller = new AbortController()
    const size = set ? 250 : 20
    const load = async () => {
      if (language === 'es') {
        if (!set && !query.trim()) return []
        const localizedSetId = set.replace(/^sv(\d)$/, 'sv0$1')
        const localizedUrl = set ? `${TCGDEX}es/sets/${localizedSetId}` : `${TCGDEX}es/cards?name=${encodeURIComponent(query)}`
        const localized = await timeout(fetch(localizedUrl, { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject(Error(r.status))), 9000)
        const localizedCards = set ? localized.cards : localized
        return (localizedCards || [])
          .filter(card => !query || card.name.toLowerCase().includes(query.toLowerCase()))
          .map(card => ({ id:card.id, name:card.name, images:{ small:tcgdexImage(card.image) }, set:{ name:localized.name || card.set?.name || 'Edición en español' }, supertype:'Carta TCG' }))
      }
      const currentPage = set ? 1 : page
      const url = `${TCG}cards?page=${currentPage}&pageSize=${size}&select=id,name,images,set,supertype,hp${q ? `&q=${encodeURIComponent(q)}` : ''}`
      const first = await timeout(fetch(url, { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject(Error(r.status))), 9000)
      if (!set || first.count >= first.totalCount) return first.data
      const allCards = [...first.data]
      const totalPages = Math.ceil(first.totalCount / size)
      for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
        try {
          const next = url.replace(`page=${currentPage}`, `page=${nextPage}`)
          const result = await timeout(fetch(next, { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject(Error(r.status))), 9000)
          allCards.push(...result.data)
        } catch {
          break
        }
      }
      return allCards
    }
    load().then(data => {
      if (!controller.signal.aborted) { setCards(data); setState('ready') }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setCards(FALLBACK_CARDS.filter(card => card.name.toLowerCase().includes(query.toLowerCase())))
        setState('fallback')
      }
    })
    return () => controller.abort()
  }, [query, set, page, language, attempt])
  const copies = id => deck.filter(c => c.id === id).length
  return <section><div className="toolbar"><label className="search">⌕<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder={language==='es'?'Busca el nombre en español…':'Busca cartas por nombre…'}/></label><label className="select"><span>◈</span><small>EXPANSIÓN</small><select value={set} onChange={e=>{setSet(e.target.value);setPage(1)}}><option value="">Todas las expansiones</option>{sets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="language-switch" aria-label="Idioma de las cartas"><button className={language==='en'?'active':''} onClick={()=>setLanguage('en')}>EN</button><button className={language==='es'?'active':''} onClick={()=>setLanguage('es')}>ES</button></div></div>{state==='loading' ? <Loader label={set?'Cargando todas las cartas de la expansión…':'Buscando cartas…'}/> : <>{language==='es'&&!set&&!query&&<p className="result-line">Elige una expansión o busca una carta para consultar las ediciones en español.</p>}{state==='fallback'&&<p className="empty">La fuente externa no respondió. Mostramos una selección disponible mientras vuelve a estar activa.<button className="secondary retry" onClick={()=>setAttempt(value=>value+1)}>Reintentar carga</button></p>}{set&&state==='ready'&&<p className="result-line">{cards.length} cartas de esta expansión en una sola vista{language==='es'?' · Edición en español':''}</p>}{state==='ready'&&language==='es'&&(set||query)&&!cards.length&&<p className="empty">No encontramos una edición localizada para esta consulta. Prueba otra expansión o búsqueda.</p>}<div className="card-grid">{cards.map(c=><article className="pokemon-card" key={c.id}><CardImage card={c}/><div><small>{c.set?.name}</small><b>{c.name}</b><span>{c.supertype}{c.hp?` · ${c.hp} PS`:''}</span></div><button disabled={copies(c.id)>=4 || deck.length>=60} onClick={()=>add(c)}>{copies(c.id)?`Añadida ×${copies(c.id)}`:'＋ Añadir'}</button></article>)}</div>{!set&&language==='en'&&<div className="pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Anterior</button><span>Página {page}</span><button disabled={state==='fallback'||cards.length<20} onClick={()=>setPage(p=>p+1)}>Siguiente →</button></div>}</>}</section>
}

function Sets({ sets, notice, open, reload }) {
  const [query,setQuery] = useState('')
  const results = useMemo(()=>sets.filter(s=>`${s.name} ${s.series}`.toLowerCase().includes(query.toLowerCase())),[sets,query])
  return <section><div className="sets-head"><div><span className="eyebrow">BIBLIOTECA TCG</span><h2>Expansiones</h2><p>Una biblioteca completa con una fuente de respaldo para evitar esperas indefinidas.</p></div><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca una expansión…"/></label></div>{notice && !sets.length ? <div className="empty"><p>{notice}</p><button className="primary" onClick={reload}>Reintentar</button></div> : <div className="sets-grid">{results.map(s=><button className="set" key={s.id} onClick={()=>open(s.id)}><div className="set-logo">{s.images?.logo?<img loading="lazy" src={s.images.logo} alt=""/>:<span>{s.series}</span>}</div><div><small>{s.series}</small><b>{s.name}</b><span>{s.total} cartas · {s.releaseDate||'sin fecha'}</span></div><i>Ver cartas →</i></button>)}</div>}</section>
}

function Regions() {
  const [region,setRegion] = useState('kanto'), [pokemon,setPokemon] = useState([]), [state,setState] = useState('loading')
  useEffect(()=>{setState('loading');getJson(`https://pokeapi.co/api/v2/pokedex/${region}`).then(d=>{setPokemon(d.pokemon_entries.sort((a,b)=>a.entry_number-b.entry_number));setState('ready')}).catch(()=>{setPokemon(regionalFallback(region));setState('fallback')})},[region])
  return <section className="regions"><div className="regions-head"><div><span className="eyebrow">POKÉDEX REGIONAL</span><h2>Pokémon por región</h2><p>Consulta el número regional y todas las especies de cada zona.</p></div><label className="select region-select"><span>◈</span><small>REGIÓN</small><select value={region} onChange={e=>setRegion(e.target.value)}>{REGIONS.map(r=><option key={r} value={r}>{pretty(r)}</option>)}</select></label></div>{state==='loading'?<Loader label="Cargando región…"/>:<>{state==='fallback'&&<p className="empty">La PokéAPI no respondió. Mostramos la Pokédex regional de respaldo.</p>}<div className="regional-grid">{pokemon.map(p=>{const id=p.pokemon_species.url.split('/').filter(Boolean).at(-1);return <article key={id}><img loading="lazy" src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} alt=""/><span>N.º {String(p.entry_number).padStart(3,'0')}</span><b>{pretty(p.pokemon_species.name)}</b></article>})}</div></>}</section>
}

const CHAOS_RISING_META = [
  {name:'Dragapult', wins:'6,121', rate:'53.04%', link:'https://play.limitlesstcg.com/decks/dragapult-ex?format=standard&rotation=2026&set=CRI'},
  {name:'Raging Bolt Ogerpon', wins:'1,725', rate:'51.40%', link:'https://play.limitlesstcg.com/decks/raging-bolt-ogerpon?format=standard&rotation=2026&set=CRI'},
  {name:'Basic Box', wins:'1,218', rate:'51.98%', link:'https://play.limitlesstcg.com/decks/basic-box-m?format=standard&rotation=2026&set=CRI'},
  {name:'Grimmsnarl Froslass', wins:'828', rate:'52.71%', link:'https://play.limitlesstcg.com/decks/grimmsnarl-froslass?format=standard&rotation=2026&set=CRI'},
  {name:'Dragapult Dudunsparce', wins:'694', rate:'50.14%', link:'https://play.limitlesstcg.com/decks/dragapult-dudunsparce?format=standard&rotation=2026&set=CRI'},
  {name:'Joltik Box', wins:'215', rate:'49.43%', link:'https://play.limitlesstcg.com/decks/joltik-box?format=standard&rotation=2026&set=CRI'},
]

function MetaDeckLibrary() {
  return <section className="meta-library"><div className="library-head"><div><span className="eyebrow">CHAOS RISING · ESTÁNDAR</span><h2>Mazos de este set</h2><p>Arquetipos con resultados publicados para el formato seleccionado.</p></div><a href="https://play.limitlesstcg.com/decks?rotation=2026&set=CRI" target="_blank" rel="noreferrer">Ver metajuego completo ↗</a></div><div className="set-meta-grid">{CHAOS_RISING_META.map((deck,index)=><a className="set-meta" href={deck.link} target="_blank" rel="noreferrer" key={deck.name}><span>#{index+1}</span><b>{deck.name}</b><small>{deck.wins} victorias</small><strong>{deck.rate}</strong></a>)}</div></section>
}

function Decks({ deck, setDeck, remove }) {
  const [name,setName] = useState('Mi nuevo mazo'), [saved,setSaved] = useState(()=>JSON.parse(localStorage.getItem('pokearchivo-decks')||'[]')), [copied,setCopied] = useState(false), [pasted,setPasted] = useState(''), [imported,setImported] = useState('')
  const groups = ['Pokémon','Trainer','Energy'].map(type=>[type,deck.filter(c=>c.supertype===type)])
  const list = [`${name} — ${deck.length}/60 cartas`,...groups.flatMap(([type,cards])=>cards.length?[`\n${type} (${cards.length})`,...Object.entries(cards.reduce((a,c)=>({...a,[c.name]:(a[c.name]||0)+1}),{})).map(([n,q])=>`${q} ${n}`)]:[])].join('\n')
  const stable = Math.min(65,Math.round(35 + deck.length*.32 + Math.min(deck.filter(c=>c.supertype==='Trainer').length,20)*.7))
  const match = meta => Math.max(25,Math.min(75,Math.round(meta.win + (stable-55)*.45)))
  function save(){if(!deck.length)return;const next=[{id:crypto.randomUUID(),name,cards:deck},...saved];setSaved(next);localStorage.setItem('pokearchivo-decks',JSON.stringify(next))}
  async function copy(){await navigator.clipboard.writeText(list);setCopied(true);setTimeout(()=>setCopied(false),1800)}
  function importList(){let category='Trainer';const cards=[];for(const line of pasted.split('\n')){const heading=line.trim().toLowerCase();if(heading.startsWith('pokémon')||heading.startsWith('pokemon')){category='Pokémon';continue}if(heading.startsWith('trainer')||heading.startsWith('entrenador')){category='Trainer';continue}if(heading.startsWith('energy')||heading.startsWith('energía')||heading.startsWith('energia')){category='Energy';continue}const match=line.trim().match(/^(\d+)\s+(.+)/);if(!match)continue;const [,quantity,cardName]=match;for(let count=0;count<Number(quantity)&&cards.length<60;count+=1)cards.push({id:`import-${crypto.randomUUID()}`,name:cardName,supertype:category,set:{name:'Lista importada'},images:{}})}if(cards.length){setDeck(cards);setName('Mazo importado');setImported(`${cards.length} cartas cargadas`)}else setImported('No encontramos cartas. Pega una lista con cantidades, por ejemplo: 4 Pikachu')}
  return <><MetaDeckLibrary/><section className="decks-v2"><div className="meta-card"><span className="eyebrow">META DE TORNEOS</span><h3>Arquetipos observados</h3>{META.map(m=><div className="meta-row" key={m.name}><span><b>{m.name}</b><small>{m.share}% de uso</small></span><strong>{m.win}%<small> victorias</small></strong></div>)}<a href="https://play.limitlesstcg.com/decks" target="_blank" rel="noreferrer">Ver datos y listas de torneos en Limitless ↗</a></div><div className="deck-main"><div className="deck-top"><div><span className="eyebrow">CONSTRUCTOR DE MAZOS</span><h2>{name}</h2><input value={name} onChange={e=>setName(e.target.value)} aria-label="Nombre del mazo"/></div><div className={deck.length===60?'counter ready':'counter'}><b>{deck.length}</b><span>/ 60 cartas</span></div></div><div className="deck-import"><div><b>Pega una lista de mazo</b><small>Copia una lista desde Limitless y cárgala aquí para editarla.</small></div><textarea value={pasted} onChange={e=>setPasted(e.target.value)} placeholder={'Pokémon\n4 Pikachu\n\nTrainer\n4 Ultra Ball\n\nEnergy\n8 Lightning Energy'}/><button className="secondary" onClick={importList}>Cargar lista</button>{imported&&<span>{imported}</span>}</div>{!deck.length?<p className="empty large">Tu mazo está vacío. Añade cartas desde el catálogo o pega una lista.</p>:groups.map(([type,cards])=>cards.length&&<div className="deck-group" key={type}><h3>{type}<span>{cards.length}</span></h3>{cards.map((c,i)=><div className="deck-row" key={`${c.id}-${i}`}><img src={c.images?.small} alt=""/><span><b>{c.name}</b><small>{c.set?.name}</small></span><button onClick={()=>remove(c.id)}>×</button></div>)}</div>)}<div className="deck-actions"><button className="primary" disabled={!deck.length} onClick={save}>Guardar mazo</button><button className="secondary" disabled={!deck.length} onClick={copy}>{copied?'Copiado':'Copiar lista'}</button><button className="secondary" disabled={!deck.length} onClick={()=>setDeck([])}>Vaciar</button></div></div><aside className="odds"><span className="eyebrow">SIMULADOR DE CONSISTENCIA</span><h3>{stable}%<small> preparación estimada</small></h3><p>Estimación basada en el tamaño y composición actual del mazo; no sustituye resultados reales de torneo.</p>{META.map(m=><div key={m.name}><span>{m.name}</span><b>{match(m)}%</b><i><em style={{width:`${match(m)}%`}}/></i></div>)}</aside><aside className="saved"><span className="eyebrow">TU ARCHIVO</span><h3>Mazos guardados</h3>{saved.length?saved.map(d=><div className="saved-deck" key={d.id}><button onClick={()=>setDeck(d.cards)}><b>{d.name}</b><span>{d.cards.length} cartas</span></button><button onClick={()=>{const next=saved.filter(x=>x.id!==d.id);setSaved(next);localStorage.setItem('pokearchivo-decks',JSON.stringify(next))}}>×</button></div>):<p>Aún no has guardado mazos.</p>}</aside></section></>
}

export default function App(){const [view,setView]=useState('cards'),[deck,setDeck]=useState([]),[filter,setFilter]=useState(''),{sets,notice}=useSets();const nav={cards:'Cartas',sets:'Expansiones',pokemon:'Pokémon',decks:'Mazos'};const add=c=>{if(deck.length<60&&deck.filter(x=>x.id===c.id).length<4)setDeck(d=>[...d,c])};return <div className="app"><header><a className="brand" href="#"><span className="ball">◉</span>poké<span>archivo</span></a><nav>{Object.entries(nav).map(([id,label])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}>{label}{id==='decks'&&deck.length?<i>{deck.length}</i>:null}</button>)}</nav><span className="header-note">ARCHIVO DE ENTRENADORES</span></header><main><section className="hero"><div><span className="eyebrow">● POKÉMON TCG & POKÉDEX</span><h1>{nav[view]}<span> para explorar.</span></h1></div><p>Catálogo, regiones, mazos y referencias competitivas en un mismo lugar.</p></section>{view==='cards'&&<Cards key={filter} initialSet={filter} sets={sets} deck={deck} add={add}/>} {view==='sets'&&<Sets sets={sets} notice={notice} reload={()=>location.reload()} open={id=>{setFilter(id);setView('cards')}}/>} {view==='pokemon'&&<Regions/>} {view==='decks'&&<Decks deck={deck} setDeck={setDeck} remove={id=>setDeck(d=>d.filter((c,i)=>i!==d.findIndex(x=>x.id===id)))}/>}</main><footer><span>Proyecto de fans, sin afiliación oficial.</span><span>Datos de Pokémon TCG API, PokéAPI y estadísticas públicas de Limitless TCG.</span></footer></div>}
