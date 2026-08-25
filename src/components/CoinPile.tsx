import { useEffect, useState, type ReactElement } from 'react'
import { formatCents } from '../lib/money'

// Représentation « positionnelle » façon système décimal : chaque palier
// vaut 10 fois le précédent (10 $ / 100 $ / 1 000 $ / 100 000 $ / 1 M$), et
// le montant est décomposé comme on rendrait la monnaie (le plus gros
// dénominateur d'abord). L'habillage visuel de chaque palier (pièce, jeton,
// gemme, symbole…) change selon le thème actif ; la logique de hiérarchie
// (5 paliers, mêmes seuils, empilement vertical max 10) reste identique
// partout.

const TIER_VALUES = [10, 100, 1_000, 100_000, 1_000_000]
const MAX_STACK_HEIGHT = 10

function decompose(totalDollars: number): number[] {
  let remaining = Math.max(0, Math.floor(totalDollars))
  const counts = new Array(TIER_VALUES.length).fill(0)
  for (let i = TIER_VALUES.length - 1; i >= 0; i--) {
    counts[i] = Math.floor(remaining / TIER_VALUES[i])
    remaining -= counts[i] * TIER_VALUES[i]
  }
  return counts
}

interface Stack {
  count: number
  tierIndex: number
}

function buildStacks(counts: number[]): Stack[] {
  const stacks: Stack[] = []
  for (let t = 0; t < TIER_VALUES.length; t++) {
    let remaining = counts[t]
    while (remaining > 0) {
      const n = Math.min(MAX_STACK_HEIGHT, remaining)
      stacks.push({ count: n, tierIndex: t })
      remaining -= n
    }
  }
  return stacks
}

const CENTER_X = 150
const BASE_Y = 132
const COIN_THICKNESS = 7
const RX = 12
const RY = 5.5
const SAME_GAP = 26
const GROUP_GAP = 36

function stackXs(stacks: Stack[]): number[] {
  const xs: number[] = []
  let x = 0
  for (let i = 0; i < stacks.length; i++) {
    if (i > 0) {
      x += stacks[i].tierIndex === stacks[i - 1].tierIndex ? SAME_GAP : GROUP_GAP
    }
    xs.push(x)
  }
  const width = xs.length ? xs[xs.length - 1] : 0
  const offset = CENTER_X - width / 2
  return xs.map((v) => v + offset)
}

// ---------- Détection du thème actif (réagit aux changements en direct) ----------

function useActiveTheme(): string {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme ?? 'classique')
  useEffect(() => {
    const target = document.documentElement
    const observer = new MutationObserver(() => {
      setTheme(target.dataset.theme ?? 'classique')
    })
    observer.observe(target, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

// ---------- Dégradés (un seul <defs> plat, générés à partir de données) ----------

const GRADIENT_DATA: { id: string; stops: string[]; linear?: boolean }[] = [
  // Classique
  { id: 'g-classique-0', stops: ['#F3C6A5', '#C87F4A', '#8B4A24'] },
  { id: 'g-classique-1', stops: ['#F8FAFC', '#C3C9D1', '#868D96'] },
  { id: 'g-classique-2', stops: ['#FFF3C4', '#F0C24B', '#B8860B'] },
  { id: 'g-classique-3', stops: ['#F3FBFF', '#9FE0F5', '#3FA9D6'], linear: true },
  { id: 'g-classique-4', stops: ['#FFE3EC', '#E63960', '#8B1032'], linear: true },
  // Vegas — jetons de casino
  { id: 'g-vegas-0', stops: ['#FFFFFF', '#E8E8EC', '#B8B8C4'] },
  { id: 'g-vegas-1', stops: ['#FF6B6B', '#E23B3B', '#8E1F1F'] },
  { id: 'g-vegas-2', stops: ['#4A4A55', '#26262E', '#0E0E12'] },
  { id: 'g-vegas-3', stops: ['#E79AFF', '#B84DFF', '#7A1FCC'] },
  { id: 'g-vegas-4', stops: ['#FFF3C4', '#FFD23F', '#B8860B'] },
  // Casino royal — jetons crème
  { id: 'g-royal-0', stops: ['#FFFDF5', '#F3E9CF', '#D9C79A'] },
  { id: 'g-royal-1', stops: ['#F0E0B0', '#DCC080', '#B89550'] },
  { id: 'g-royal-2', stops: ['#E6C888', '#C9A050', '#9C7830'] },
  { id: 'g-royal-3', stops: ['#E9CB6B', '#C9A227', '#8A6D1F'] },
  { id: 'g-royal-4', stops: ['#F8E9B0', '#D4AF37', '#9C7A1F'] },
  // Machine à sous — symboles
  { id: 'g-slots-0', stops: ['#FF5C5C', '#D42C2C', '#8A1414'] },
  { id: 'g-slots-1', stops: ['#FFEDA0', '#FFC94D', '#C98A1E'] },
  { id: 'g-slots-2', stops: ['#FFD966', '#C99A2E'] },
  { id: 'g-slots-3', stops: ['#FFE79E', '#FFC94D', '#B8860B'] },
  { id: 'g-slots-4', stops: ['#FFFFFF', '#FFD23F', '#FF6B6B'] },
  // Blackjack — jetons vert/rouge/or de table
  { id: 'g-blackjack-0', stops: ['#4CDB8C', '#1F8F52', '#0E4A2A'] },
  { id: 'g-blackjack-1', stops: ['#E0645C', '#B8342F', '#6E1815'] },
  { id: 'g-blackjack-2', stops: ['#F0D27A', '#D4AF37', '#8F7020'] },
  { id: 'g-blackjack-3', stops: ['#2E7D4F', '#155C33', '#0A3319'] },
  { id: 'g-blackjack-4', stops: ['#4A4A55', '#26262E', '#0E0E12'] },
  // Bubble gum — bonbons
  { id: 'g-bubblegum-0', stops: ['#FFD1E8', '#FF8FC7', '#E85BA0'] },
  { id: 'g-bubblegum-1', stops: ['#FFE0F5', '#D88FE0', '#A84FC7'] },
  { id: 'g-bubblegum-2', stops: ['#FFD9A0', '#FFA94D', '#D97B1E'] },
  { id: 'g-bubblegum-3', stops: ['#FFF0E0', '#FFCBA0', '#E89A5C'] },
  { id: 'g-bubblegum-3-wrap', stops: ['#FFB8D9', '#E85BA0'] },
  { id: 'g-bubblegum-4', stops: ['#FF8FC7', '#FFD166', '#8FE0C7', '#8FB8FF'], linear: true },
  // Naturel — éléments terreux
  { id: 'g-naturel-0', stops: ['#E8DFC8', '#B8A888', '#8A7860'] },
  { id: 'g-naturel-1', stops: ['#C98F5C', '#A8683A', '#7A4A28'] },
  { id: 'g-naturel-1-cap', stops: ['#8A6238', '#5C3E20'] },
  { id: 'g-naturel-2', stops: ['#8A5A3A', '#5C3820', '#3A2010'] },
  { id: 'g-naturel-3', stops: ['#FFFFFF', '#E0D8F0', '#B8A8D8'], linear: true },
  { id: 'g-naturel-4', stops: ['#FFF3C4', '#D4AF37', '#8A6D1F'] },
  // Québec — cuivre/argent/or puis médaillons fleur-de-lis
  { id: 'g-quebec-3', stops: ['#EAF2FF', '#9DC5F5', '#2F6FE4'], linear: true },
  { id: 'g-quebec-4', stops: ['#FFF3C4', '#F0C24B', '#B8860B'] },
  // Cosmos
  { id: 'g-cosmos-0', stops: ['#8A8A9E', '#5C5C70', '#333340'] },
  { id: 'g-cosmos-1', stops: ['#F0F0FF', '#C8C8E0', '#9898B8'] },
  { id: 'g-cosmos-2', stops: ['#E0D0FF', '#7C4DFF', '#4A2A99'] },
  { id: 'g-cosmos-3', stops: ['#FFFFFF', '#5EE6FF', '#1F8FB8'] },
  { id: 'g-cosmos-4', stops: ['#FFFFFF', '#FF9AC7', '#B84DFF'] },
  // Zaza
  { id: 'g-zaza-0', stops: ['#C9A876', '#8A6838', '#5C4420'] },
  { id: 'g-zaza-1', stops: ['#A8D878', '#6B9E3F', '#3D6023'] },
  { id: 'g-zaza-2', stops: ['#FFF3C4', '#F0C24B', '#B8860B'] },
  { id: 'g-zaza-3', stops: ['#FFE9B8', '#F0B840', '#B87818'] },
  { id: 'g-zaza-4', stops: ['#FFFFFF', '#E8F5FF', '#B8E0FF'], linear: true },
]

// ---------- Formes réutilisables (une par « type de jeton ») ----------

type TokenRenderer = (cx: number, cy: number, key: string) => ReactElement

function gemPoints(cx: number, cy: number): string {
  return [`${cx},${cy - RY - 1}`, `${cx + RX},${cy}`, `${cx},${cy + RY + 1}`, `${cx - RX},${cy}`].join(' ')
}

function starPoints(cx: number, cy: number, points: number, outerR: number, innerR: number): string {
  const step = Math.PI / points
  const coords: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = -Math.PI / 2 + i * step
    coords.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return coords.join(' ')
}

function round(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
      <ellipse cx={cx} cy={cy} rx={RX * 0.6} ry={RY * 0.55} fill="none" stroke={stroke} strokeOpacity="0.5" strokeWidth="0.8" />
    </g>
  )
}

function chip(gradId: string, stroke: string, edgeColor: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
      <ellipse cx={cx} cy={cy} rx={RX - 2.5} ry={RY - 1.2} fill="none" stroke={edgeColor} strokeWidth="1.4" strokeDasharray="2.2 2.2" />
    </g>
  )
}

function gem(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <polygon points={gemPoints(cx, cy)} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
      <line x1={cx - RX + 1} y1={cy - 1} x2={cx + RX - 1} y2={cy - 1} stroke={stroke} strokeWidth="0.6" opacity="0.6" />
    </g>
  )
}

function star(gradId: string, stroke: string, points = 5): TokenRenderer {
  return (cx, cy, key) => (
    <polygon key={key} points={starPoints(cx, cy, points, RX, RX * 0.42)} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
  )
}

function digit(char: string, gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <text key={key} x={cx} y={cy + 5.5} textAnchor="middle" fontSize="15" fontFamily="Georgia, serif" fontWeight={700} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.5">
      {char}
    </text>
  )
}

function medallion(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <text key={key} x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.4">
      ⚜
    </text>
  )
}

function leaf(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key} transform={`translate(${cx - 10},${cy - 10}) scale(0.5)`}>
      <path d="M4,20c8,1,15,-4,16,-16C10,5,4,11,4,20Z" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1.4" />
    </g>
  )
}

function blob(gradId: string, stroke: string): TokenRenderer {
  const pts: [number, number][] = [[0, -8], [5, -6], [8, -1], [6, 5], [1, 8], [-5, 6], [-8, 0], [-5, -6]]
  return (cx, cy, key) => (
    <polygon key={key} points={pts.map(([dx, dy]) => `${cx + dx},${cy + dy}`).join(' ')} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
  )
}

function bell(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key} transform={`translate(${cx},${cy})`}>
      <path d="M0,-8 C-6,-8 -8,-2 -8,3 L8,3 C8,-2 6,-8 0,-8 Z" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
      <rect x="-9" y="3" width="18" height="2.2" rx="1" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
      <circle cx="0" cy="7.4" r="1.5" fill={stroke} />
    </g>
  )
}

function bar(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => <rect key={key} x={cx - 10} y={cy - 5} width="20" height="10" rx="2" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
}

function cherry(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <line x1={cx - 3} y1={cy - 9} x2={cx} y2={cy - 4} stroke="#5C7A3A" strokeWidth="1" />
      <line x1={cx + 4} y1={cy - 9} x2={cx} y2={cy - 4} stroke="#5C7A3A" strokeWidth="1" />
      <ellipse cx={cx - 3} cy={cy + 1} rx="5" ry="4.2" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
      <ellipse cx={cx + 4} cy={cy + 1} rx="5" ry="4.2" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
    </g>
  )
}

function acorn(gradId: string, capGradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <ellipse cx={cx} cy={cy + 2} rx="6.5" ry="7.5" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
      <ellipse cx={cx} cy={cy - 5} rx="7.5" ry="4.5" fill={`url(#${capGradId})`} stroke={stroke} strokeWidth="0.8" />
    </g>
  )
}

function chestnut(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <path
      key={key}
      d={`M${cx},${cy - 10} C${cx - 6},${cy - 4} ${cx - 8},${cy + 1} ${cx - 7},${cy + 6} C${cx - 6},${cy + 10} ${cx - 2.5},${cy + 12} ${cx},${cy + 12} C${cx + 2.5},${cy + 12} ${cx + 6},${cy + 10} ${cx + 7},${cy + 6} C${cx + 8},${cy + 1} ${cx + 6},${cy - 4} ${cx},${cy - 10} Z`}
      fill={`url(#${gradId})`}
      stroke={stroke}
      strokeWidth="0.8"
    />
  )
}

function bear(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <circle cx={cx - 5} cy={cy - 7} r="3" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.7" />
      <circle cx={cx + 5} cy={cy - 7} r="3" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.7" />
      <ellipse cx={cx} cy={cy + 1} rx="9" ry="9.5" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
    </g>
  )
}

function cupcake(gradId: string, wrapGradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <path d={`M${cx - 8},${cy} L${cx + 8},${cy} L${cx + 6},${cy + 9} L${cx - 6},${cy + 9} Z`} fill={`url(#${wrapGradId})`} stroke={stroke} strokeWidth="0.8" />
      <path d={`M${cx - 8},${cy} C${cx - 8},${cy - 9} ${cx + 8},${cy - 9} ${cx + 8},${cy} Z`} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
    </g>
  )
}

function lollipop(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <line x1={cx} y1={cy + 4} x2={cx} y2={cy + 11} stroke="#D8C9B8" strokeWidth="1.4" />
      <circle cx={cx} cy={cy - 1} r="7" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
    </g>
  )
}

function seed(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => <ellipse key={key} cx={cx} cy={cy} rx="5" ry="7" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" transform={`rotate(15 ${cx} ${cy})`} />
}

function bud(gradId: string, stroke: string): TokenRenderer {
  return (cx, cy, key) => (
    <g key={key}>
      <ellipse cx={cx} cy={cy} rx="7" ry="10" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
      <ellipse cx={cx - 2} cy={cy - 3} rx="3" ry="4" fill="rgba(255,255,255,0.15)" />
    </g>
  )
}

// ---------- Habillage par thème (5 paliers, du commun au rare) ----------

const THEME_TIERS: Record<string, TokenRenderer[]> = {
  classique: [
    round('g-classique-0', '#5C3216'),
    round('g-classique-1', '#5A5F66'),
    round('g-classique-2', '#8A6D1F'),
    gem('g-classique-3', '#1F6E8C'),
    gem('g-classique-4', '#5C0E22'),
  ],
  vegas: [
    chip('g-vegas-0', '#6B6B78', '#444455'),
    chip('g-vegas-1', '#5A1010', '#FFFFFF'),
    chip('g-vegas-2', '#000000', '#D4AF37'),
    chip('g-vegas-3', '#4A0F80', '#5EE6FF'),
    chip('g-vegas-4', '#7A5A10', '#FFFFFF'),
  ],
  royal: [
    chip('g-royal-0', '#8A7550', '#C9A227'),
    chip('g-royal-1', '#6B5530', '#C9A227'),
    chip('g-royal-2', '#5A4520', '#F3E9CF'),
    chip('g-royal-3', '#5A1420', '#F3E9CF'),
    chip('g-royal-4', '#7A1020', '#FFFDF5'),
  ],
  slots: [
    cherry('g-slots-0', '#5A0E0E'),
    bell('g-slots-1', '#7A5510'),
    bar('g-slots-2', '#1A1A1A'),
    digit('7', 'g-slots-3', '#7A5510'),
    star('g-slots-4', '#7A1414'),
  ],
  blackjack: [
    chip('g-blackjack-0', '#06331C', '#F0E6D2'),
    chip('g-blackjack-1', '#3A0D0B', '#F0E6D2'),
    chip('g-blackjack-2', '#4A3810', '#0E4A2A'),
    chip('g-blackjack-3', '#04200F', '#D4AF37'),
    chip('g-blackjack-4', '#000000', '#D4AF37'),
  ],
  bubblegum: [
    round('g-bubblegum-0', '#A83C72'),
    lollipop('g-bubblegum-1', '#6B2F80'),
    bear('g-bubblegum-2', '#8A5010'),
    cupcake('g-bubblegum-3', 'g-bubblegum-3-wrap', '#A83C72'),
    gem('g-bubblegum-4', '#6B3358'),
  ],
  naturel: [
    round('g-naturel-0', '#5C4E3A'),
    acorn('g-naturel-1', 'g-naturel-1-cap', '#4A2E18'),
    chestnut('g-naturel-2', '#240F05'),
    gem('g-naturel-3', '#6B5A80'),
    blob('g-naturel-4', '#5A4310'),
  ],
  quebec: [
    round('g-classique-0', '#5C3216'),
    round('g-classique-1', '#5A5F66'),
    round('g-classique-2', '#8A6D1F'),
    medallion('g-quebec-3', '#003DA5'),
    medallion('g-quebec-4', '#003DA5'),
  ],
  cosmos: [
    blob('g-cosmos-0', '#1A1A24'),
    round('g-cosmos-1', '#606080'),
    round('g-cosmos-2', '#2A1A5C'),
    star('g-cosmos-3', '#0A4A5C'),
    star('g-cosmos-4', '#5A1A80', 8),
  ],
  zaza: [
    seed('g-zaza-0', '#3A2C14'),
    bud('g-zaza-1', '#24380F'),
    leaf('g-zaza-2', '#7A5A10'),
    gem('g-zaza-3', '#6B4A10'),
    gem('g-zaza-4', '#4A90B8'),
  ],
}

export function CoinPile({ totalCents }: { totalCents: number }) {
  const totalDollars = Math.floor(Math.max(0, totalCents) / 100)
  const counts = decompose(totalDollars)
  const stacks = buildStacks(counts)
  const xs = stackXs(stacks)
  const activeTheme = useActiveTheme()
  const tiers = THEME_TIERS[activeTheme] ?? THEME_TIERS.classique

  return (
    <div>
      <svg
        viewBox="0 0 300 170"
        style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`Piles de jetons représentant ${formatCents(totalCents)} de revenus encaissés`}
      >
        <defs>
          {GRADIENT_DATA.map((g) =>
            g.linear ? (
              <linearGradient id={g.id} key={g.id} x1="0%" y1="0%" x2="100%" y2="100%">
                {g.stops.map((c, i) => (
                  <stop key={i} offset={`${(i / (g.stops.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </linearGradient>
            ) : (
              <radialGradient id={g.id} key={g.id} cx="35%" cy="30%" r="75%">
                {g.stops.map((c, i) => (
                  <stop key={i} offset={`${(i / (g.stops.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </radialGradient>
            ),
          )}
        </defs>
        {stacks.length > 0 && (
          <ellipse cx={CENTER_X} cy={BASE_Y + 14} rx={Math.max(60, (xs[xs.length - 1] ?? 0) - (xs[0] ?? 0) + 40) / 2} ry="7" fill="rgba(0,0,0,0.12)" />
        )}
        {stacks.map((stackItem, si) =>
          Array.from({ length: stackItem.count }).map((_, ci) => {
            const cx = xs[si]
            const cy = BASE_Y - ci * COIN_THICKNESS
            const renderer = tiers[stackItem.tierIndex]
            return renderer(cx, cy, `${si}-${ci}`)
          }),
        )}
      </svg>
      <div
        className="mono"
        style={{
          textAlign: 'center',
          marginTop: 10,
          fontSize: 'clamp(16px, 4vw, 22px)',
          fontWeight: 600,
          color: 'var(--moss)',
        }}
      >
        {formatCents(totalCents)}
      </div>
      {totalCents === 0 && (
        <p className="status-msg" style={{ textAlign: 'center', margin: '4px 0 0' }}>
          Aucune facture payée pour l'instant.
        </p>
      )}
    </div>
  )
}
