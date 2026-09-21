import { motion } from 'framer-motion'

/**
 * MISC — boot beats that were taken out of the sequence, kept rather than deleted.
 *
 * Removed from Boot.tsx on Ibrahim's instruction: the segmented loading bar
 * with its scrolling log, and the wireframe human figure. Nothing here is
 * imported by the running interface. It is parked so that the work is not lost
 * and so the sequence can be put back without rewriting it from the film.
 *
 * The boot now runs two beats instead of four: the reticle rings resolving the
 * name, then the arc reactor lighting. Both of the pieces below slotted into
 * the same stage clock, so restoring either means re-adding its stage boundary
 * to `T` and its branch in the stage switch.
 *
 *   - `BootBar`  was beat 1, rendered above the stage rather than inside it,
 *     and needed `barPct` and `logShown` derived from the clock.
 *   - `Suit`     was beat 3, between the rings and the reactor.
 *   - `Rings`    was beat 2, the reticle resolving the name. Removed later, when
 *     the sequence was cut to the single arc-reactor beat.
 */

const BOOT_LOG = [
  'MOUNT F:/BACKUP/GHOST (HIDDEN)',
  'EXTEND SYSTEM MEMORY .......... OK',
  'TELEMETRY / COMP CLIMATION',
  'REMOVE SYSTEM CONFIGURATION',
  'CHECKSUM ...................... OK',
  'RUN SYSTEM TOOL',
]

/** Beat 1: the angular status bar over a scrolling boot log. */
export function BootBar({
  dim,
  barPct,
  logShown,
}: {
  dim: boolean
  barPct: number
  logShown: number
}) {
  return (
    <div className={`boot-bar ${dim ? 'boot-bar-dim' : ''}`}>
      <div className="boot-bar-frame">
        <span className="boot-bar-title">
          INITIATING SYSTEM 1<span className="boot-dots">…</span>
          <span className="boot-cursor" />
        </span>
        <div className="boot-seg">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={i} className="boot-seg-cell" data-on={i / 22 < barPct ? '1' : '0'} />
          ))}
        </div>
      </div>
      <div className="boot-log">
        {BOOT_LOG.slice(0, logShown).map((l) => (
          <div key={l} className="boot-log-line">
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Beat 3: the suit schematic — a wireframe figure flanked by component
 * call-outs, the way the film flashes the armour blueprint mid-boot.
 */
export function Suit({ reduced }: { reduced: boolean }) {
  return (
    <svg className="boot-suit" viewBox="-200 -150 400 300">
      <motion.g
        className="boot-suit-fig"
        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.path
          className="boot-wire"
          d="M0,-118 C11,-118 17,-108 17,-96 C17,-86 12,-80 12,-74
             L22,-64 L30,-30 L26,26 L34,64 L28,66 L18,30 L16,64 L20,110
             L6,112 L2,66 L-2,66 L-6,112 L-20,110 L-16,64 L-18,30 L-28,66
             L-34,64 L-26,26 L-30,-30 L-22,-64 L-12,-74 C-12,-80 -17,-86 -17,-96
             C-17,-108 -11,-118 0,-118 Z"
          initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
        <path
          className="boot-wire boot-wire-dim"
          d="M-9,-104 L9,-104 M-8,-96 L8,-96 M0,-92 L0,-84"
        />
        <circle className="boot-wire" cx="0" cy="-40" r="9" />
        <path className="boot-wire boot-wire-dim" d="M0,-49 L0,-31 M-9,-40 L9,-40" />
      </motion.g>

      {[-150, 150].map((x, i) => (
        <motion.g
          key={x}
          className="boot-callout"
          initial={reduced ? { opacity: 1 } : { opacity: 0, x: x > 0 ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
        >
          <circle className="boot-wire" cx={x} cy="-10" r="26" strokeDasharray="30 6 6 6" />
          <circle className="boot-wire boot-wire-dim" cx={x} cy="-10" r="15" />
          <circle className="boot-wire" cx={x} cy="-10" r="3" />
          <path
            className="boot-wire boot-wire-dim"
            d={x > 0 ? `M${x - 26},-10 L60,-10` : `M${x + 26},-10 L-60,-10`}
          />
        </motion.g>
      ))}
      <text x="-150" y="34" className="boot-tag">
        RT / PWR
      </text>
      <text x="150" y="34" className="boot-tag">
        DEP / MK
      </text>
    </svg>
  )
}


/** Beat 2: concentric reticle rings drawing inward, the name resolving last. */
export function Rings({ reduced }: { reduced: boolean }) {
  const ease = 'easeOut'
  const ring = (r: number, delay: number, dash: string, w = 1) => (
    <motion.circle
      cx="0"
      cy="0"
      r={r}
      className="boot-ring"
      strokeDasharray={dash}
      strokeWidth={w}
      initial={reduced ? { opacity: 1 } : { opacity: 0, rotate: -40, scale: 1.15 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease }}
    />
  )
  return (
    <svg className="boot-rings" viewBox="-160 -160 320 320">
      <g>
        {ring(150, 0.0, '3 6')}
        {ring(128, 0.08, '40 8 12 8', 1.4)}
        {ring(104, 0.16, '2 4')}
        {ring(84, 0.24, '30 6 6 6', 1.6)}
        {ring(60, 0.34, '1 3')}
      </g>
      <motion.text
        x="0"
        y="6"
        className="boot-name"
        initial={reduced ? { opacity: 1 } : { opacity: 0, letterSpacing: '1.4em' }}
        animate={{ opacity: 1, letterSpacing: '0.42em' }}
        transition={{ duration: 0.7, delay: 0.5, ease }}
      >
        J.A.R.V.I.S
      </motion.text>
    </svg>
  )
}

