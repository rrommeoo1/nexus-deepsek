import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { EditorialPage } from './EditorialPage';
import { editorialDocumentForPost, editorialMediaForPost } from '../lib/editorialPost';
import type { SocialPost } from '../lib/socialTypes';
import type { TextStyle } from '../lib/textStyle';
import type { PageMode } from '../lib/pageMode';
import type { RailReserve } from '../lib/textPage';

/**
 * The published page of a text-first post.
 *
 * It is the *same* `EditorialPage` the composer mounts: one flow engine, one media geometry, one
 * paginator. A page arranged on the phone therefore reaches the feed unchanged. Only the words/media
 * sources differ (the server's `/media/...` files instead of the phone's gallery), and the reader
 * cannot move anything.
 *
 * `null` for a post written before documents existed: those pages keep the legacy `PostTextReading`
 * composition instead of being reinterpreted by a newer engine.
 */
export function EditorialArticle({
  post, style, active = true, pageStyle, railReserve = null, folio, mode = 'paper',
}: {
  post: SocialPost;
  style: TextStyle;
  active?: boolean;
  pageStyle?: StyleProp<ViewStyle>;
  /**
   * The reader's page mode (`lib/pageMode.ts`): the same article on warm paper or on matte black. It is
   * the *reader's* choice, so it arrives from the surface that mounted the page (`PostCanvas`), never
   * from the row being read.
   */
  mode?: PageMode;
  /**
   * The room the page's own rail keeps in its lower right corner (`RailReserve`): the words narrow
   * beside the buttons and keep the whole measure above them, instead of a column of paper running the
   * full height of the page (owner's rejection, 27 October 2026).
   */
  railReserve?: RailReserve | null;
  /**
   * The row the folio is printed in (`lib/textPage.ts::folioRow`). Passed straight through to the one
   * `EditorialPage` that draws the page: a reader opened from a profile prints its number lower, and the
   * feed, the composer and every card keep the row they had.
   */
  folio?: { band: number; inset: number };
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const document = editorialDocumentForPost(post);
  if (!document) return null;
  return (
    <View
      style={[styles.frame, pageStyle]}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
      }}
    >
      {box.width > 40 && box.height > 80 ? (
        <EditorialPage
          document={document}
          style={style}
          media={editorialMediaForPost(post)}
          width={box.width}
          height={box.height}
          active={active}
          railReserve={railReserve}
          folio={folio}
          mode={mode}
          accessibilityLabel="Pagina articolului"
        />
      ) : null}
    </View>
  );
}

export function hasEditorialDocument(post?: SocialPost | null): boolean {
  return Boolean(editorialDocumentForPost(post));
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
});
