import { useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Core } from './Core'
// Particles is deliberately not rendered; see the note in Rig(). The import
// stays commented rather than removed so restoring the dust is two lines.
// import { Particles } from './Particles'
import { Orbits } from './Orbits'
import { useStore, phaseColor, accentFor, type Phase } from '../store'

/** Rings spin harder while JARVIS is working — reads as effort. */
const spinFor: Record<Phase, number> = {
  offline: 0.08, // barely turning — the machine is off
  boot: 3.2,
  dormant: 0.25,
  waking: 4.5,
  listening: 1.1,
  thinking: 2.8,
  tooling: 3.6,
  speaking: 1.4,
}

/**
 * Surface displacement amplitude. Both states where nothing is happening get
 * the calm figure: 'offline' is the quietest moment in the whole piece — the
 * reactor hasn't been powered on yet — so it must not be the most agitated
 * thing on screen.
 */
/*
 * Much lower than they were. At 0.13/0.26 on a unit sphere the displacement is
 * a quarter of the radius, which is not a reactor breathing — it is a potato.
 * The reference core is a clean circle whose surface only shimmers; the drama
 * belongs to the instrument rings around it, not to the silhouette.
 */
const AMP_CALM = 0.035
const AMP_LIVE = 0.085

/**
 * Everything the three children animate from, in one mutable object.
 *
 * These used to be render-time props, which had two consequences. The scene
 * subscribed to mic level, so the entire r3f tree reconciled sixty times a
 * second for numbers that never leave useFrame; and because they were only
 * delivered on a re-render, they were delivered late or — before the analyser
 * starts and `level` is a constant zero — not at all, which is why the ignition
 * screen never picked up its own spin rate.
 *
 * Nothing here belongs in React state. The scene is updated by mutation and
 * React only ever mounts it: Rig writes this object once per frame, the
 * children read it in their own useFrame. Children subscribe to the frame loop
 * before their parent does, so they are reading the previous frame's values —
 * one frame of lag on quantities that are all lerped anyway, and invisible.
 */
export type Drive = {
  color: THREE.Color
  /** 0..1 smoothed loudness, with an idle breath under it. */
  level: number
  /** Rotation multiplier for the drifting dust. */
  spin: number
  /** Target displacement amplitude for the core surface. */
  amp: number
  /** 0..1 power-up reveal — the ring assembles outwards from the centre. */
  open: number
  /**
   * The reactor slice of the ui state, already resolved and smoothed.
   *
   * Everything here is a no-op at UI_DEFAULTS: colour follows the phase exactly
   * as it always did, and the three multipliers sit at one.
   */
  reactor: {
    /** ui.reactor.color if set, otherwise the accent. */
    color: THREE.Color
    scale: number
    intensity: number
    /** Multiplier on the ring's own rotation rate. */
    spin: number
    /** 0 ring, 1 sphere, 2 wire — a number because it ends up in a uniform. */
    style: number
    visible: boolean
  }
}

/**
 * A colour target that only re-parses when the string actually changes.
 *
 * The colours in the ui slice are arbitrary CSS written by JARVIS, and
 * THREE.Color.set logs a warning for anything it cannot parse. Setting one
 * unconditionally per frame turns a single typo into sixty console lines a
 * second, which drowns everything else out during a demo.
 */
type Tint = { key: string; color: THREE.Color }

function aim(tint: Tint, css: string): THREE.Color {
  if (tint.key !== css) {
    tint.key = css
    tint.color.set(css)
  }
  return tint.color
}

const STYLE_INDEX = { ring: 0, sphere: 1, wire: 2 } as const

function Rig() {
  const drive = useMemo<Drive>(
    () => ({
      color: new THREE.Color(phaseColor.offline),
      level: 0,
      spin: spinFor.offline,
      amp: AMP_CALM,
      open: 0,
      reactor: {
        color: new THREE.Color(phaseColor.offline),
        scale: 1,
        intensity: 1,
        spin: 1,
        style: STYLE_INDEX.ring,
        visible: true,
      },
    }),
    [],
  )
  const target = useMemo<Tint>(() => ({ key: '', color: new THREE.Color() }), [])
  const reactorTarget = useMemo<Tint>(
    () => ({ key: '', color: new THREE.Color() }),
    [],
  )

  useFrame((state, dt) => {
    // Read imperatively rather than subscribing — see the note on Drive.
    const { phase, level, ui } = useStore.getState()

    // accentFor owns the accent -> palette -> phase resolution order. The scene
    // asking the store for the answer rather than working it out again is what
    // keeps the orb and the HUD from ever disagreeing about the colour.
    const accent = accentFor(phase, ui)
    drive.color.lerp(aim(target, accent), Math.min(1, dt * 2.5))

    const r = ui.reactor
    drive.reactor.color.lerp(
      aim(reactorTarget, r.color ?? accent),
      Math.min(1, dt * 2.5),
    )
    // Smoothed rather than assigned, so "make it twice the size" grows into
    // place instead of snapping. The style is the exception: it is a mode, and
    // easing between two of them would drag the picture through the third.
    const k = Math.min(1, dt * 5)
    // Note: reactor.scale is NOT smoothed here. It is driven further down,
    // where the breath is, because that is the one place that knows both the
    // commanded size and the swell it has to be multiplied by. Smoothing it
    // twice simply fought itself.
    drive.reactor.intensity += (r.intensity - drive.reactor.intensity) * k
    drive.reactor.spin += (r.spin - drive.reactor.spin) * k
    drive.reactor.style = STYLE_INDEX[r.style] ?? STYLE_INDEX.ring
    drive.reactor.visible = r.visible

    drive.spin += (spinFor[phase] - drive.spin) * Math.min(1, dt * 2)
    drive.amp = phase === 'dormant' || phase === 'offline' ? AMP_CALM : AMP_LIVE
    // Held shut until the reactor is powered on, so the ring builds itself out
    // of the centre on the ignition click rather than simply appearing.
    drive.open = phase === 'offline' ? 0.28 : phase === 'boot' ? 0.7 : 1.6

    /**
     * Breathing, and the reason there is more of it than there used to be.
     *
     * At its old size the orb filled the middle of the screen and any movement
     * at all was plenty. Shrunk to an indicator it has the opposite problem: a
     * small thing that holds perfectly still reads as a flat icon, so the life
     * has to come from motion rather than from sheer presence.
     *
     * Two sine waves at unrelated rates rather than one. A single sine is a
     * pulse and the eye locks onto its period within a couple of cycles; two
     * that do not divide into each other never repeat on any timescale anybody
     * watches, which is what makes it read as breathing rather than as
     * flashing.
     */
    const idle = phase === 'offline' ? 0.04 : phase === 'dormant' ? 0.11 : 0.2
    const slow = Math.sin(state.clock.elapsedTime * 0.62) * 0.5 + 0.5
    const fast = Math.sin(state.clock.elapsedTime * 1.37 + 1.1) * 0.5 + 0.5
    const breathe = (slow * 0.72 + fast * 0.28) * idle
    const want = Math.max(level, breathe)
    drive.level += (want - drive.level) * Math.min(1, dt * 9)

    /**
     * A slow swell in the size on top of it.
     *
     * Brightness alone is what the level drives, and brightness on its own
     * reads as a lamp being turned up. Scaling very slightly with it is what
     * makes it read as something inflating and settling, which is the whole
     * difference between a glowing circle and a thing that is alive.
     *
     * Deliberately tiny. Past a few percent the ring starts visibly pumping
     * and the illusion breaks in the other direction.
     */
    const swell = 1 + (slow - 0.5) * 0.045 + drive.level * 0.05
    drive.reactor.scale = drive.reactor.scale * 0.88 + r.scale * swell * 0.12

    // Slow drift on the camera keeps handheld-ish life in the shot.
    const t = state.clock.elapsedTime
    state.camera.position.x = Math.sin(t * 0.13) * 0.35
    state.camera.position.y = Math.cos(t * 0.17) * 0.22
    state.camera.lookAt(0, 0, 0)
  })

  // Nothing in here is lit: both the core and the dust are raw ShaderMaterials,
  // which do not read the light list. The scene therefore has no lights at all.
  //
  // The tilted gyro rings that used to sit here are gone. Steeply tilted arcs
  // crossing in front of a complete circle do not read as depth — they read as
  // scratches on the lens, and as broken circles in a design whose whole
  // subject is one unbroken one.
  return (
    <>
      <Core drive={drive} />
      {/*
        The drifting dust is off at Ibrahim's request.

        Not deleted: Particles.tsx is untouched and still takes the same
        `drive` object, so restoring it is re-adding this one line. It earned
        its place when the reactor filled the frame and the field around it
        read as depth. Now that the orb is an indicator rather than a backdrop,
        a screen of moving specks competes with the transcript for attention
        and reads as noise around a small object instead of atmosphere around
        a large one.
      */}
      <Orbits />
    </>
  )
}

export function Scene() {
  return (
    <Canvas
      className="scene"
      /*
       * Left at 6.2 deliberately, and worth recording why.
       *
       * Pulling the camera back is the obvious way to shrink the reactor and
       * it is the wrong one. The core is a fixed-size plane carrying a shader
       * that fits its ring to the r3f viewport (see FIT in Core.tsx), so
       * moving the camera changes the viewport the shader is fitting to and
       * the ring grows to compensate, arriving at a larger, squarer blob than
       * it started as. FIT is the size control. This is the framing.
       */
      camera={{ position: [0, 0, 6.2], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <Rig />
      {/*
        multisampling={0} on purpose. The default is 8, which allocates a
        half-float MSAA target — at dpr 2 that is a 3200x1800 buffer — and there
        is not one polygon edge in this scene for it to smooth: everything is
        additive blobs, point sprites and lines, all of which are already
        soft-edged by their own falloff and then blurred again by bloom.

        Tone mapping is also deliberate, if less obviously so. EffectComposer
        forces gl.toneMapping to NoToneMapping while it is mounted (there is no
        prop for it), so the additive output clips instead of rolling off. That
        hard clip to white is the neon look this piece wants — the sweep and the
        rim are meant to blow out. If you ever want the filmic roll-off back,
        add a <ToneMapping mode={ToneMappingMode.ACES_FILMIC} /> effect at the
        end of this chain rather than touching the renderer.
      */}
      <EffectComposer multisampling={0}>
        {/* Bloom is what turns additive lines into "hologram". */}
        {/* Down from 1.15. Bloom is what decides how much of the screen the
            reactor owns: at the old figure its halo reached well past the ring
            itself and sat under the transcript, so shrinking the ring alone
            did not actually make it recede. */}
        <Bloom
          intensity={0.78}
          // A higher threshold keeps the mid-tones intact so the orb doesn't
          // flatten into a solid white disc.
          luminanceThreshold={0.22}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.72}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0009, 0.0012)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={0.035} blendFunction={BlendFunction.OVERLAY} />
        <Vignette eskil={false} offset={0.22} darkness={0.95} />
      </EffectComposer>
    </Canvas>
  )
}
