import { formatCents } from '../lib/money'

// Pyramide fixe de 15 pièces (5 rangées) — l'or ne s'anime pas, seul le
// nombre de pièces visibles (du bas vers le haut) grandit avec le montant.
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
const PILE_REFERENCE_CENTS = 75_000 * 100

export function CoinPile({ totalCents }: { totalCents: number }) {
  const fraction = Math.min(1, Math.max(0, totalCents / PILE_REFERENCE_CENTS))
  const coinsVisibles = totalCents > 0 ? Math.max(1, Math.round(fraction * COINS.length)) : 0

  return (
    <div>
      <svg
        viewBox="0 0 200 140"
        style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`Pile de pièces représentant ${formatCents(totalCents)} de revenus encaissés`}
      >
        <defs>
          <radialGradient id="coinFace" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#FFF3C4" />
            <stop offset="45%" stopColor="#F0C24B" />
            <stop offset="100%" stopColor="#B8860B" />
          </radialGradient>
        </defs>
        {coinsVisibles > 0 && (
          <ellipse cx="100" cy="130" rx="82" ry="8" fill="rgba(0,0,0,0.12)" />
        )}
        {COINS.slice(0, coinsVisibles).map((c, i) => (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy} r="16" fill="url(#coinFace)" stroke="#8A6D1F" strokeWidth="1" />
            <circle cx={c.cx} cy={c.cy} r="10.5" fill="none" stroke="rgba(138,109,31,0.55)" strokeWidth="1" />
          </g>
        ))}
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
