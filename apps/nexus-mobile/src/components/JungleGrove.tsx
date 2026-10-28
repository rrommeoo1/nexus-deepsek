import { memo } from 'react';
import { blackSilver } from '../theme/blackSilver';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The jungle the words of a text post are read in.
 *
 * The owner, 20 October 2026: „vreau ca pe fundalul postarilor gen text, sa adaugi un fundal discret cu
 * muschi sau frunze de padure jungla, care sa creeze imaginea de jungla pe fundal, dar sa nu afecteze
 * continutul, si ochii utilizatorului". Three rules follow from that sentence, and they are the whole
 * design of this file:
 *
 *   discreet        nothing here is brighter than moss seen out of focus. The strongest pigments are the
 *                   carpet on the rock at 34 % of `#6fb377` and the orchid petals at 44 % of `#b195e6`
 *                   over the plate's `#0d1210`: one step of colour above the card, not a picture;
 *   not the words   the light and the leaves live at the frame's *edges* — the fronds are cropped by it,
 *                   the moss is a band at its foot — and a soft well is laid over the middle before the
 *                   words are printed on top, so the type keeps its contrast instead of fighting a
 *                   texture (`dim` is that well's strength);
 *   not the eyes    no white, no saturated colour, nothing fine enough to shimmer while the page moves:
 *                   canopy light in the top right, a far treeline, two shafts of sun, a mossy boulder,
 *                   two fronds, one fern, one moss bed, six orchids at the foot of the frame, a vignette.
 *                   One `Svg` per page.
 *
 * The picture itself is the one the owner described on the evening of 20 October 2026: a large boulder
 * in the middle of the frame under a thick carpet of moss, purple orchids blooming at its foot, ferns and
 * trees behind it, and soft sun coming down through the canopy. Everything in that sentence is here, and
 * every part of it is dimmer than the words it sits under.
 *
 * It is seeded by the post's own id, so a column of text posts is not a column of identical leaves, and
 * the same post always grows the same grove: a rebuild of the list never shuffles the picture under the
 * words. Nothing here answers a touch (`pointerEvents="none"`) and nothing is announced
 * (`accessible={false}`) — it is scenery, not content.
 */
export const JungleGrove = memo(function JungleGrove({ seed = '', dim = 0.34 }: {
  /** The post's id: the same post always gets the same grove. */
  seed?: string;
  /** How dark the well behind the words is — the one number a surface may raise for tiny type. */
  dim?: number;
}) {
  const hash = hashOf(seed);
  const id = `nxGrove-${hash}`;
  /** Three growths: tilted a little left, straight, tilted right. */
  const tilt = [-7, 2, 11][hash % 3];
  /** Every grove leans its orchids a little differently, but each post leans the same way every time. */
  const sway = (hash % 9) - 4;
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {/** The light that comes through the canopy: one wide, soft source, top right. */}
          <RadialGradient id={`${id}-light`} cx="78%" cy="6%" r="74%">
            <Stop offset="0" stopColor={blackSilver.bright} stopOpacity={0.1} />
            <Stop offset="0.45" stopColor={blackSilver.silver} stopOpacity={0.05} />
            <Stop offset="1" stopColor={blackSilver.silver} stopOpacity={0} />
          </RadialGradient>
          {/** Moss, low left: the forest floor rather than a wall. */}
          <RadialGradient id={`${id}-moss`} cx="8%" cy="96%" r="62%">
            <Stop offset="0" stopColor={blackSilver.deepMercury} stopOpacity={0.14} />
            <Stop offset="1" stopColor={blackSilver.deepMercury} stopOpacity={0} />
          </RadialGradient>
          {/** A second bed behind the rail's side, dimmer, so the column of presses stays quiet. */}
          <RadialGradient id={`${id}-moss2`} cx="96%" cy="58%" r="44%">
            <Stop offset="0" stopColor={blackSilver.matteBlack} stopOpacity={0.09} />
            <Stop offset="1" stopColor={blackSilver.matteBlack} stopOpacity={0} />
          </RadialGradient>
          {/** The rock: a domed silhouette one step above the plate, so the moss has something to stand on. */}
          <LinearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4b5548" stopOpacity={0.26} />
            <Stop offset="0.38" stopColor="#202a22" stopOpacity={0.36} />
            <Stop offset="1" stopColor={blackSilver.deepBlack} stopOpacity={0.5} />
          </LinearGradient>
          {/** The carpet: moss on the crown, lit at the shoulder, thinning down the face of the rock. */}
          <LinearGradient id={`${id}-carpet`} x1="0.2" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={blackSilver.silver} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={blackSilver.deepMercury} stopOpacity={0.2} />
            <Stop offset="1" stopColor={blackSilver.matteBlack} stopOpacity={0} />
          </LinearGradient>
          {/** The far trees: only a shade, so the frame has depth without a second picture in it. */}
          <LinearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={blackSilver.deepBlack} stopOpacity={0.4} />
            <Stop offset="0.55" stopColor={blackSilver.deepBlack} stopOpacity={0.16} />
            <Stop offset="1" stopColor={blackSilver.deepBlack} stopOpacity={0} />
          </LinearGradient>
          {/** Sun through the canopy: two soft wedges, faint enough to read as light and nothing more. */}
          <LinearGradient id={`${id}-shaft`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#eaf4d6" stopOpacity={0.09} />
            <Stop offset="0.5" stopColor="#cfe4b8" stopOpacity={0.03} />
            <Stop offset="1" stopColor="#cfe4b8" stopOpacity={0} />
          </LinearGradient>
          {/** The orchid's petals: a violet that is still shadow, never a flower laid on the page. */}
          <LinearGradient id={`${id}-orchid`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#b195e6" stopOpacity={0.44} />
            <Stop offset="0.6" stopColor="#8664bd" stopOpacity={0.26} />
            <Stop offset="1" stopColor="#4a3468" stopOpacity={0.05} />
          </LinearGradient>
          {/** The throat, the one bright note in the picture, and it is the size of a dot. */}
          <RadialGradient id={`${id}-throat`} cx="50%" cy="40%" r="60%">
            <Stop offset="0" stopColor="#e2d3f8" stopOpacity={0.34} />
            <Stop offset="1" stopColor="#8a6cc0" stopOpacity={0.06} />
          </RadialGradient>
          {/** The frond: lit at its root, almost the card's own black at the tip. */}
          <LinearGradient id={`${id}-frond`} x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={blackSilver.silver} stopOpacity={0.5} />
            <Stop offset="0.6" stopColor={blackSilver.deepMercury} stopOpacity={0.26} />
            <Stop offset="1" stopColor={blackSilver.matteBlack} stopOpacity={0.05} />
          </LinearGradient>
          {/** The moss bed under the frame's foot. */}
          <LinearGradient id={`${id}-bed`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={blackSilver.deepMercury} stopOpacity={0.15} />
            <Stop offset="1" stopColor={blackSilver.deepMercury} stopOpacity={0} />
          </LinearGradient>
          {/** The corners come back to the card's black, which is what keeps the page from glowing. */}
          <RadialGradient id={`${id}-vignette`} cx="50%" cy="44%" r="78%">
            <Stop offset="0" stopColor="#05080a" stopOpacity={0} />
            <Stop offset="0.62" stopColor="#05080a" stopOpacity={0} />
            <Stop offset="1" stopColor="#05080a" stopOpacity={0.46} />
          </RadialGradient>
          {/**
           * The well: a shade of its own under the words. It is drawn *after* the leaves, so the middle of
           * the frame is the darkest part of the grove and the type never sits on a texture.
           */}
          <RadialGradient id={`${id}-well`} cx="50%" cy="50%" r="54%">
            <Stop offset="0" stopColor="#04070a" stopOpacity={dim} />
            <Stop offset="0.7" stopColor="#04070a" stopOpacity={dim * 0.42} />
            <Stop offset="1" stopColor="#04070a" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect width="360" height="640" fill={`url(#${id}-light)`} />
        <Rect width="360" height="640" fill={`url(#${id}-moss)`} />
        <Rect width="360" height="640" fill={`url(#${id}-moss2)`} />

        {/**
         * The forest behind the rock: a canopy line drawn as a shade, not as trees. It is the only layer
         * allowed to be *darker* than the plate, which is what gives the frame depth without adding light.
         */}
        <Path
          d="M0 300 C 20 278 40 288 58 272 C 76 256 96 270 114 254 C 134 236 154 258 172 244 C 192 228 214 250 232 238 C 252 224 272 248 292 236 C 314 222 336 246 360 232 L 360 430 L 0 430 Z"
          fill={`url(#${id}-far)`}
        />

        {/** Sun coming down through the canopy: two wedges between the trees, behind the rock. */}
        <Path d="M236 0 L 306 0 L 214 300 L 176 300 Z" fill={`url(#${id}-shaft)`} />
        <Path d="M310 0 L 344 0 L 286 232 L 258 232 Z" fill={`url(#${id}-shaft)`} />

        {/** The boulder: a rock with a crown and a dark foot, standing in the moss at the foot of the frame. */}
        <Path
          d="M86 562 C 76 520 84 480 106 454 C 124 432 152 418 180 420 C 204 422 222 434 234 452 C 246 470 252 498 254 524 C 256 542 252 556 246 562 C 244 564 238 564 228 564 L 100 564 C 90 564 86 562 86 562 Z"
          fill={`url(#${id}-rock)`}
        />

        {/**
         * The carpet: one band of moss over the crown, its lower edge hanging in uneven lobes, with three
         * tufts sitting on it so the band reads as a thick carpet and not as a smooth green cap.
         */}
        <G fill={`url(#${id}-carpet)`}>
          <Path d="M108 496 C 112 460 140 434 172 426 C 200 420 222 430 236 450 C 244 462 248 474 248 486 C 242 500 232 508 220 512 C 216 500 217 490 220 482 C 210 500 196 508 180 512 C 177 500 178 490 181 482 C 170 502 154 510 136 512 C 133 500 134 490 137 482 C 128 502 118 512 106 514 C 102 502 104 496 108 496 Z" />
          <Ellipse cx={128} cy={462} rx={17} ry={9} transform="rotate(-8 128 462)" />
          <Ellipse cx={176} cy={444} rx={21} ry={10} transform="rotate(4 176 444)" />
          <Ellipse cx={218} cy={458} rx={15} ry={8} transform="rotate(10 218 458)" />
        </G>

        {/** The large frond: rooted off the right edge, cropped by the frame, behind the words. */}
        <G transform={`rotate(${tilt} 360 0)`}>
          <Path d="M362 4 C 318 46 288 122 282 206 C 318 196 346 172 362 146 Z" fill={`url(#${id}-frond)`} />
          <Path d="M362 4 C 326 74 296 148 284 202" fill="none" stroke="#9cc79c" strokeOpacity={0.14} strokeWidth={1.3} />
          <Path d="M362 236 C 330 264 310 308 306 352 C 334 344 352 326 362 306 Z" fill={`url(#${id}-frond)`} />
        </G>

        {/** The answering leaf, upper left: the head of the page sits over its tail. */}
        <G transform={`rotate(${-tilt} 0 0)`} opacity={0.85}>
          <Path d="M-4 86 C 40 64 86 32 124 -8 C 126 40 92 84 42 104 C 18 112 2 106 -4 86 Z" fill={`url(#${id}-frond)`} />
        </G>

        {/** The fern, low left: the one shape with detail, and it points away from the rail. */}
        <G transform={`translate(2 596) rotate(${-12 - tilt})`}>
          <Path d="M0 0 C 52 -14 104 -34 152 -62" fill="none" stroke={blackSilver.silver} strokeOpacity={0.15} strokeWidth={2} strokeLinecap="round" />
          {FERN.map((index) => {
            const x = 14 + index * 21;
            const y = -2 - index * 5.4;
            const rx = 12 - index;
            return (
              <G key={index}>
                <Ellipse cx={x} cy={y - 13} rx={rx} ry={4.4} transform={`rotate(-34 ${x} ${y - 13})`} fill={`url(#${id}-frond)`} />
                <Ellipse cx={x} cy={y + 13} rx={rx} ry={4.4} transform={`rotate(34 ${x} ${y + 13})`} fill={`url(#${id}-frond)`} />
              </G>
            );
          })}
        </G>

        <Rect y={462} width="360" height={178} fill={`url(#${id}-bed)`} />
        <Rect width="360" height="640" fill={`url(#${id}-vignette)`} />

        {/**
         * The orchids: two sprays at the foot of the frame, one in each lower corner, rising out of the
         * moss on their stems. Over the vignette, so the violet survives the darkest part of the page;
         * where the last lines of type run through them they are still only a step above the plate.
         */}
        {STEMS.map((stem) => (
          <Path
            key={stem}
            d={stem}
            fill="none"
            stroke={blackSilver.silver}
            strokeOpacity={0.18}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        ))}
        {BLOOMS.map((bloom) => orchid(id, bloom, sway))}

        <Rect width="360" height="640" fill={`url(#${id}-well)`} />
      </Svg>
    </View>
  );
});

/** Seven leaflets a side: enough to read as a fern, few enough to stay a silhouette. */
const FERN = Array.from({ length: 7 }, (_, index) => index);

/**
 * A phalaenopsis read from across the room: three sepals and two broader petals, so the bloom does not turn
 * into a daisy. Angles run clockwise from the top; `at` is how far the petal sits out from the throat.
 */
const PETALS = [
  { angle: 0, rx: 7, ry: 4.4, at: 9.4 },
  { angle: 66, rx: 8.6, ry: 5.2, at: 9 },
  { angle: 294, rx: 8.6, ry: 5.2, at: 9 },
  { angle: 124, rx: 7, ry: 4.4, at: 8.6 },
  { angle: 236, rx: 7, ry: 4.4, at: 8.6 },
];

/**
 * Where the orchids bloom: two sprays — one in the left corner of the frame, one at the right foot of the
 * boulder — three blooms apiece, the biggest at the bottom, a smaller one behind it and a bud climbing.
 * The x values never leave 33..327 (`slice` crops a phone taller than 360×640, and a flower cropped away
 * is a flower paid for and never seen) and never enter 230..300 either: that column belongs to the rail's
 * presses, and a violet under a bookmark is a mistake, not a frame. The y values stop at 540, because the
 * bar covers the frame's last 63 units.
 */
const BLOOMS = [
  { x: 64, y: 526, scale: 1.1, turn: -16 },
  { x: 40, y: 492, scale: 0.85, turn: 12 },
  { x: 52, y: 452, scale: 0.6, turn: -4 },
  { x: 226, y: 528, scale: 1.05, turn: 16 },
  { x: 212, y: 488, scale: 0.8, turn: -10 },
  { x: 224, y: 450, scale: 0.58, turn: 6 },
];

/** Two stems, one a side, rising out of the moss behind the bar into their spray. */
const STEMS = ['M46 640 C 50 604 56 566 64 534', 'M210 640 C 214 606 220 566 226 532'];

/** One orchid: three sepals, two petals and a lip. Nothing in it is fine enough to shimmer when the page scrolls. */
function orchid(
  id: string,
  bloom: { x: number; y: number; scale: number; turn: number },
  sway: number,
) {
  return (
    <G
      key={`${bloom.x}-${bloom.y}`}
      transform={`translate(${bloom.x} ${bloom.y}) rotate(${bloom.turn + sway}) scale(${bloom.scale})`}
    >
      {PETALS.map((petal) => (
        <Ellipse
          key={petal.angle}
          cx={0}
          cy={-petal.at}
          rx={petal.rx}
          ry={petal.ry}
          transform={`rotate(${petal.angle})`}
          fill={`url(#${id}-orchid)`}
        />
      ))}
      <Ellipse cx={0} cy={8.4} rx={4.6} ry={5.8} fill={`url(#${id}-throat)`} />
    </G>
  );
}

/** A stable number for a post's id — the grove must not shuffle when the list is rebuilt. */
function hashOf(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (Math.imul(hash, 31) + seed.charCodeAt(index)) | 0;
  return Math.abs(hash);
}
