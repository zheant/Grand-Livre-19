import { formatCents } from '../lib/money'

// Pyramide fixe de 15 emplacements (5 rangées) — seuls le nombre de pièces
// visibles (du bas vers le haut) et leur matière changent avec le montant.
const COIN_ROWS: { cx: number; cy: number }[][] = [
  [
    { cx: 30, cy: 118 },
    { cx: 65, cy: 118 },
    { cx: 100, cy: 118 },
    { cx: 135, cy: 118 },
    { cx: 170, cy: 118 },
  ],
  [
    { cx: 47.5, cy: 94 },
    { cx: 82.5, cy: 94 },
    { cx: 117.5, cy: 94 },
    { cx: 152.5, cy: 94 },
  ],
  [
    { cx: 65, cy: 70 },
    { cx: 100, cy: 70 },
    { cx: 135, cy: 70 },
  ],
  [
    { cx: 82.5, cy: 46 },
    { cx: 117.5, cy: 46 },
  ],
  [{ cx: 100, cy: 24 }],
]
const COINS = COIN_ROWS.flat()

// Montant qui remplit complètement la pile (pur repère visuel, pas une
// cible officielle) — au-delà, la pile reste pleine plutôt que déborder.
// Divisé en 4 paliers de rareté égaux : chacun se remplit puis cède la
// place au suivant plutôt que de s'accumuler avec lui.
const PILE_REFERENCE_CENTS = 200_000 * 100
const TIER_SPAN_CENTS = PILE_REFERENCE_CENTS / 4

interface Tier {
  label: string
  icon: string
  gradientId: string
  stroke: string
  gem?: boolean
}

const TIERS: Tier[] = [
  { label: 'Cuivre', icon: '🥉', gradientId: 'tierCopper', stroke: '#5C3216' },
  { label: 'Argent', icon: '🥈', gradientId: 'tierSilver', stroke: '#5A5F66' },
  { label: 'Or', icon: '🥇', gradientId: 'tierGold', stroke: '#8A6D1F' },
  { label: 'Diamant', icon: '💎', gradientId: 'tierDiamond', stroke: '#1F6E8C', gem: true },
]

function diamondPoints(cx: number, cy: number): string {
  return [`${cx},${cy - 16}`, `${cx + 12},${cy - 2}`, `${cx},${cy + 14}`, `${cx - 12},${cy - 2}`].join(' ')
}

export function CoinPile({ totalCents }: { totalCents: number }) {
  const clamped = Math.max(0, totalCents)
  const tierIndex = Math.min(TIERS.length - 1, Math.floor(clamped / TIER_SPAN_CENTS))
  const tier = TIERS[tierIndex]
  const withinTierFraction = Math.min(1, (clamped - TIER_SPAN_CENTS * tierIndex) / TIER_SPAN_CENTS)
  const coinsVisibles = clamped > 0 ? Math.max(1, Math.round(withinTierFraction * COINS.length)) : 0

  return (
    <div>
      {coinsVisibles > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--ink-soft)',
            marginBottom: 4,
          }}
        >
          {tier.icon} Palier {tier.label}
        </div>
      )}
      <svg
        viewBox="0 0 200 140"
        style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`Pile de ${tier.label.toLowerCase()} représentant ${formatCents(clamped)} de revenus encaissés`}
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
        </defs>
        {coinsVisibles > 0 && <ellipse cx="100" cy="130" rx="82" ry="8" fill="rgba(0,0,0,0.12)" />}
        {COINS.slice(0, coinsVisibles).map((c, i) =>
          tier.gem ? (
            <g key={i}>
              <polygon
                points={diamondPoints(c.cx, c.cy)}
                fill={`url(#${tier.gradientId})`}
                stroke={tier.stroke}
                strokeWidth="1"
              />
              <line x1={c.cx - 12} y1={c.cy - 2} x2={c.cx + 12} y2={c.cy - 2} stroke={tier.stroke} strokeWidth="0.7" opacity="0.6" />
              <line x1={c.cx} y1={c.cy - 16} x2={c.cx} y2={c.cy - 2} stroke={tier.stroke} strokeWidth="0.7" opacity="0.4" />
            </g>
          ) : (
            <g key={i}>
              <circle cx={c.cx} cy={c.cy} r="16" fill={`url(#${tier.gradientId})`} stroke={tier.stroke} strokeWidth="1" />
              <circle cx={c.cx} cy={c.cy} r="10.5" fill="none" stroke={tier.stroke} strokeOpacity="0.55" strokeWidth="1" />
            </g>
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
        {formatCents(clamped)}
      </div>
      {clamped === 0 && (
        <p className="status-msg" style={{ textAlign: 'center', margin: '4px 0 0' }}>
          Aucune facture payée pour l'instant.
        </p>
      )}
    </div>
  )
}
