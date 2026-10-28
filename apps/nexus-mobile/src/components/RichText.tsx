import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { richTextSegments } from '../lib/richText';
import { openSocialProfile } from '../lib/profileNavigation';
import { openTagPage } from '../lib/tagNavigation';
import { socialTokens } from '../theme/social';

/**
 * A post's words, with the marks inside them painted (`lib/richText.ts`).
 *
 * A caption is one `<Text>`: it wraps, it clamps to `numberOfLines`, and it can carry the press. The
 * three marks cannot be coloured from outside it, so each one is a nested `<Text>` — the only way
 * React Native lets one sentence wear four inks without breaking the paragraph into blocks that no
 * longer share a line height.
 *
 * The inks belong to the brand's own palette (`theme/social.ts`): a tag is the ticker's teal, a
 * mention is the light cyan of a door, and a link is underlined because an address that looks like
 * prose is a trap. Every mark keeps the paragraph's weight, so a tag never reads as a different
 * sentence from the one it sits in.
 *
 * A mark is also a door (owner's rule, 19 October 2026): `@nume` opens that creator's profile and
 * `#subiect` opens the tag's own page — the two doors the web wires into its captions
 * (`captionWithTagsMarkup` -> `data-tag` -> `openTagPage`, `app.js:4032-4052`). The press lives on the
 * nested `<Text>` itself, which is exactly why the paragraph can stay one paragraph: three inks and two
 * doors inside one sentence, never a row of chips. Both doors are the product's own, so a caption, a
 * quote panel and a page of words all behave the same; a surface may still pass its own (`onMention`,
 * `onHashtag`), and a test does.
 */
export function RichText({
  text, style, numberOfLines, ellipsizeMode, onPress, hashtagStyle, mentionStyle, linkStyle, accessibilityLabel,
  allowFontScaling, onMention = openSocialProfile, onHashtag = openTagPage,
}: {
  text?: string | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /**
   * A line of a page is already broken by the flow engine, so it must not be shortened again: it is
   * clipped, never given an ellipsis that would print a word the author never wrote.
   */
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  onPress?: () => void;
  /**
   * A page of words is measured in fixed points (`lib/fontMetrics.ts`), so it must be *drawn* in fixed
   * points too: the system's font scale would enlarge every glyph of the paragraph while the flow still
   * believed it fitted (29 October 2026). Omitted, a caption keeps the reader's own type size.
   */
  allowFontScaling?: boolean;
  /** A surface may paint the marks differently (a tile's miniatures, a quote panel's ink). */
  hashtagStyle?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  /** The profile door of a `@nume`; the handle arrives without its mark. */
  onMention?: (handle: string) => void;
  /** The tag page door of a `#subiect`; the tag arrives without its mark. */
  onHashtag?: (tag: string) => void;
}) {
  const segments = richTextSegments(text);
  if (!segments.length) return null;
  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      allowFontScaling={allowFontScaling}
    >
      {segments.map((segment, index) => {
        /**
         * A mention and a tag are the only marks with somewhere to go: a link is underlined prose on this
         * network (the web prints it as text too, `captionWithTagsMarkup` escapes it), so it stays a mark.
         */
        const door = segment.kind === 'mention'
          ? () => onMention(segment.text.replace(/^@/, ''))
          : segment.kind === 'hashtag'
            ? () => onHashtag(segment.text.replace(/^#/, ''))
            : undefined;
        return (
          <Text
            key={`${segment.kind}-${index}`}
            accessibilityRole={door ? 'link' : undefined}
            accessibilityLabel={door ? segment.text : undefined}
            allowFontScaling={allowFontScaling}
            onPress={door}
            style={segment.kind === 'hashtag'
              ? [styles.hashtag, hashtagStyle]
              : segment.kind === 'mention'
                ? [styles.mention, mentionStyle]
                : segment.kind === 'link'
                  ? [styles.link, linkStyle]
                  : undefined}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  /** The ticker's own teal (`socialTokens.ticker.doorInk`), so a tag and a door read alike. */
  hashtag: { color: socialTokens.ticker.doorInk, fontWeight: '700' },
  /** The light cyan of every other door of the product. */
  mention: { color: socialTokens.ticker.linkInk, fontWeight: '700' },
  link: { color: socialTokens.ticker.linkInk, textDecorationLine: 'underline' },
});
