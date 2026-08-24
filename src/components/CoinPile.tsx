import { formatCents } from '../lib/money'

// Représentation « positionnelle » façon système décimal : chaque palier
// vaut 10 fois le précédent, et le montant est décomposé comme on rendrait
// la monnaie (le plus gros dénominateur d'abord). Le tas résultant peut donc
// mélanger plusieurs matières à la fois — pas un seul palier actif.
interface Denomination {
  valueDollars: number
  gradientId: string
  stroke: string
  gem?: boolean
}

const DENOMINATIONS: Denomination[] = [
  { valueDollars: 10, gradientId: 'tierCopper', stroke: '#5C3216' },
  { valueDollars: 100, gradientId: 'tierSilver', stroke: '#5A5F66' },
  { valueDollars: 1_000, gradientId: 'tierGold', stroke: '#8A6D1F' },
  { valueDollars: 10_000, gradientId: 'tierDiamond', stroke: '#1F6E8C', gem: true },
  { valueDollars: 100_000, gradientId: 'tierRuby', stroke: '#5C0E22', gem: true },
]

function decompose(totalDollars: number): number[] {
  let remaining = Math.max(0, Math.floor(totalDollars))
  const counts = new Array(DENOMINATIONS.length).fill(0)
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    counts[i] = Math.floor(remaining / DENOMINATIONS[i].valueDollars)
    remaining -= counts[i] * DENOMINATIONS[i].valueDollars
  }
  return counts
}

const CENTER_X = 110
const BASE_Y = 158
const ROW_HEIGHT = 22
const COIN_SPACING = 22
const MAX_PER_ROW = 9
const RADIUS = 10

interface Row {
  cy: number
  xs: number[]
  denom: Denomination
}

function buildRows(counts: number[]): Row[] {
  const rows: Row[] = []
  let level = 0
  for (let d = 0; d < DENOMINATIONS.length; d++) {
    let remaining = counts[d]
    while (remaining > 0) {
      const n = Math.min(MAX_PER_ROW, remaining)
      const startX = CENTER_X - ((n - 1) * COIN_SPACING) / 2
      rows.push({
        cy: BASE_Y - level * ROW_HEIGHT,
        xs: Array.from({ length: n }, (_, i) => startX + i * COIN_SPACING),
        denom: DENOMINATIONS[d],
      })
      level += 1
      remaining -= n
    }
  }
  return rows
}

function gemPoints(cx: number, cy: number): string {
  return [`${cx},${cy - RADIUS - 1}`, `${cx + RADIUS - 1},${cy - 1}`, `${cx},${cy + RADIUS}`, `${cx - RADIUS + 1},${cy - 1}`].join(
    ' ',
  )
}

export function CoinPile({ totalCents }: { totalCents: number }) {
  const totalDollars = Math.floor(Math.max(0, totalCents) / 100)
  const counts = decompose(totalDollars)
  const rows = buildRows(counts)

  return (
    <div>
      <svg
        viewBox="0 0 220 190"
        style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`Tas de pièces et gemmes représentant ${formatCents(totalCents)} de revenus encaissés`}
      >
        <defs>
          <radialGradient id="tierCopper" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#F3C6A5" />
            <stop offset="45%" stopColor="#C87F4A" />
            <stop offset="100%" stopColor="#8B4A24" />
          </radialGradient>
          <radialGradient id="tierSilver" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="45%" stopColor="#C3C9D1" />
            <stop offset="100%" stopColor="#868D96" />
          </radialGradient>
          <radialGradient id="tierGold" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#FFF3C4" />
            <stop offset="45%" stopColor="#F0C24B" />
            <stop offset="100%" stopColor="#B8860B" />
          </radialGradient>
          <linearGradient id="tierDiamond" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F3FBFF" />
            <stop offset="45%" stopColor="#9FE0F5" />
            <stop offset="100%" stopColor="#3FA9D6" />
          </linearGradient>
          <linearGradient id="tierRuby" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE3EC" />
            <stop offset="45%" stopColor="#E63960" />
            <stop offset="100%" stopColor="#8B1032" />
          </linearGradient>
        </defs>
        {rows.length > 0 && <ellipse cx={CENTER_X} cy={BASE_Y + 18} rx="92" ry="8" fill="rgba(0,0,0,0.12)" />}
        {rows.map((row, ri) =>
          row.xs.map((x, i) =>
            row.denom.gem ? (
              <g key={`${ri}-${i}`}>
                <polygon
                  points={gemPoints(x, row.cy)}
                  fill={`url(#${row.denom.gradientId})`}
                  stroke={row.denom.stroke}
                  strokeWidth="1"
                />
                <line x1={x - RADIUS + 1} y1={row.cy - 1} x2={x + RADIUS - 1} y2={row.cy - 1} stroke={row.denom.stroke} strokeWidth="0.6" opacity="0.6" />
              </g>
            ) : (
              <g key={`${ri}-${i}`}>
                <circle cx={x} cy={row.cy} r={RADIUS} fill={`url(#${row.denom.gradientId})`} stroke={row.denom.stroke} strokeWidth="1" />
                <circle cx={x} cy={row.cy} r={RADIUS * 0.6} fill="none" stroke={row.denom.stroke} strokeOpacity="0.55" strokeWidth="0.8" />
              </g>
            ),
          ),
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
