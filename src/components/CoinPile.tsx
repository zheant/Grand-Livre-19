import { formatCents } from '../lib/money'

// Représentation « positionnelle » façon système décimal : chaque palier
// vaut 10 fois le précédent, et le montant est décomposé comme on rendrait
// la monnaie (le plus gros dénominateur d'abord). Chaque dénomination forme
// une ou plusieurs colonnes (piles) de pièces empilées verticalement, max 5
// de haut — au-delà, une nouvelle pile de la même matière démarre à côté.
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
  { valueDollars: 100_000, gradientId: 'tierDiamond', stroke: '#1F6E8C', gem: true },
  { valueDollars: 1_000_000, gradientId: 'tierRuby', stroke: '#5C0E22', gem: true },
]

const MAX_STACK_HEIGHT = 10

function decompose(totalDollars: number): number[] {
  let remaining = Math.max(0, Math.floor(totalDollars))
  const counts = new Array(DENOMINATIONS.length).fill(0)
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    counts[i] = Math.floor(remaining / DENOMINATIONS[i].valueDollars)
    remaining -= counts[i] * DENOMINATIONS[i].valueDollars
  }
  return counts
}

interface Stack {
  count: number
  denom: Denomination
}

function buildStacks(counts: number[]): Stack[] {
  const stacks: Stack[] = []
  for (let d = 0; d < DENOMINATIONS.length; d++) {
    let remaining = counts[d]
    while (remaining > 0) {
      const n = Math.min(MAX_STACK_HEIGHT, remaining)
      stacks.push({ count: n, denom: DENOMINATIONS[d] })
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
      x += stacks[i].denom === stacks[i - 1].denom ? SAME_GAP : GROUP_GAP
    }
    xs.push(x)
  }
  const width = xs.length ? xs[xs.length - 1] : 0
  const offset = CENTER_X - width / 2
  return xs.map((v) => v + offset)
}

function gemPoints(cx: number, cy: number): string {
  return [`${cx},${cy - RY - 1}`, `${cx + RX},${cy}`, `${cx},${cy + RY + 1}`, `${cx - RX},${cy}`].join(' ')
}

export function CoinPile({ totalCents }: { totalCents: number }) {
  const totalDollars = Math.floor(Math.max(0, totalCents) / 100)
  const counts = decompose(totalDollars)
  const stacks = buildStacks(counts)
  const xs = stackXs(stacks)

  return (
    <div>
      <svg
        viewBox="0 0 300 170"
        style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`Piles de pièces et gemmes représentant ${formatCents(totalCents)} de revenus encaissés`}
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
        {stacks.length > 0 && (
          <ellipse cx={CENTER_X} cy={BASE_Y + 14} rx={Math.max(60, (xs[xs.length - 1] ?? 0) - (xs[0] ?? 0) + 40) / 2} ry="7" fill="rgba(0,0,0,0.12)" />
        )}
        {stacks.map((stack, si) =>
          Array.from({ length: stack.count }).map((_, ci) => {
            const cx = xs[si]
            const cy = BASE_Y - ci * COIN_THICKNESS
            const isTop = ci === stack.count - 1
            return stack.denom.gem ? (
              <g key={`${si}-${ci}`}>
                <polygon points={gemPoints(cx, cy)} fill={`url(#${stack.denom.gradientId})`} stroke={stack.denom.stroke} strokeWidth="1" />
                {isTop && (
                  <line x1={cx - RX + 2} y1={cy} x2={cx + RX - 2} y2={cy} stroke={stack.denom.stroke} strokeWidth="0.6" opacity="0.6" />
                )}
              </g>
            ) : (
              <g key={`${si}-${ci}`}>
                <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={`url(#${stack.denom.gradientId})`} stroke={stack.denom.stroke} strokeWidth="1" />
                {isTop && <ellipse cx={cx} cy={cy} rx={RX * 0.6} ry={RY * 0.55} fill="none" stroke={stack.denom.stroke} strokeOpacity="0.5" strokeWidth="0.8" />}
              </g>
            )
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
