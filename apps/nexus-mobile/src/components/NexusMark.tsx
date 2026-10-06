import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { socialTokens } from '../theme/social';

/**
 * The marks of the bottom bar and of the drawer, drawn exactly as the web draws them.
 * Every path below is copied from apps/nexus-web/public/nav-marks.js and
 * apps/nexus-web/public/feed-surface.js (`FEED_ICONS`). Nothing here is an emoji, because an emoji is
 * a different drawing on every device.
 */
export type NavSlot = 'primary' | 'inbox' | 'search' | 'create' | 'friends' | 'utility' | 'account';

const paths: Record<string, string> = {
  primary: 'M4 11.5 12 4l8 7.5V20h-5v-5H9v5H4z',
  inbox: 'M4 5.5h16v11H9l-5 3v-14Z',
  search: 'M15.6 15.6 21 21',
  friends: 'M2.6 20a6.4 6.4 0 0 1 12.8 0M15.8 5.6a3.5 3.5 0 0 1 0 6.1M17.6 20a6.2 6.2 0 0 0-2.1-4.5',
  utility: 'M8 9a5 5 0 0 0 0 6M16 9a5 5 0 0 1 0 6M5 6a9 9 0 0 0 0 12M19 6a9 9 0 0 1 0 12',
  account: 'M4.5 21a7.5 7.5 0 0 1 15 0',
};

const circles: Record<string, readonly [number, number, number][]> = {
  search: [[11, 11, 6]],
  friends: [[9, 8.5, 3.6]],
  utility: [[12, 12, 2.5]],
  account: [[12, 8, 4]],
};

/** `.appNav button[data-slot="primary"] i svg path{fill:rgba(255,255,255,.08)}` */
const filledSlots = new Set<NavSlot>(['primary']);

export function NexusMark({ slot, size = socialTokens.nav.icon.size as number, color = socialTokens.colors.white }: {
  slot: NavSlot; size?: number; color?: string;
}) {
  const strokeWidth = socialTokens.nav.icon.strokeWidth * (size / socialTokens.nav.icon.size);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={paths[slot]}
        fill={filledSlots.has(slot) ? 'rgba(255,255,255,0.08)' : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {circles[slot] ? circles[slot].map(([cx, cy, r]) => (
        <Circle key={`${slot}-${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} />
      )) : null}
    </Svg>
  );
}

/** `FEED_ICONS.close` — the way out of the drawer. */
export function CloseMark({ size = socialTokens.feedHeader.iconButton.iconSize as number, color = socialTokens.colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={color} strokeWidth={socialTokens.feedHeader.iconButton.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** `FEED_ICONS.logout` — the last tile of the drawer. */
export function LogoutMark({ size = socialTokens.feedHeader.iconButton.iconSize as number, color = socialTokens.colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3v9" fill="none" stroke={color} strokeWidth={socialTokens.feedHeader.iconButton.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.05 5.7a8 8 0 1 0 9.9 0" fill="none" stroke={color} strokeWidth={socialTokens.feedHeader.iconButton.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** `FEED_ICONS.modules` — the source/module switch of the feed header. */
export function ModulesMark({ size = socialTokens.feedHeader.iconButton.iconSize as number, color = socialTokens.colors.white }: { size?: number; color?: string }) {
  const stroke = socialTokens.feedHeader.iconButton.strokeWidth;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={4} width={12} height={9} rx={2} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={9} y={11} width={12} height={9} rx={2} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 17h3m-1.7-1.7L8 17l-1.7 1.7M19 7h-3m1.7-1.7L16 7l1.7 1.7" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
