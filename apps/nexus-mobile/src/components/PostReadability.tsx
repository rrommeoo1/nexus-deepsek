import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { wordsScrim, type ScrimGeometry } from '../lib/readability';

/**
 * Straturile de citire ale unei compoziții: un gradient, desenat exact peste banda pe care o măsoară
 * `lib/readability.ts`, niciodată peste o înălțime ghicită.
 *
 * `anchor` este singura decizie de așezare: capul crește de sus în jos, descrierea crește de jos în sus.
 * Stratul nu este interactiv (`pointerEvents="none"`), deci nu poate fura o atingere de la o reacție, de
 * la `Citește tot` sau de la o etichetă trasă pe poză; și este desenat **după** ce a scris autorul pe
 * imagine (`mediaOverlay`) și **înainte** de cuvintele compoziției, adică exact ordinea pe care o cer
 * suprafețele: imagine → conținutul autorului → scrim → cap/descriere/controale.
 */
export function PostScrim({ id, geometry, color, anchor = 'top' }: {
  /** Identitatea gradientului în SVG: un id per post, ca două cadre să nu împartă aceeași definiție. */
  id: string;
  /** `null` când nu există măsurătoare — atunci nu se desenează nimic. */
  geometry: ScrimGeometry | null;
  /** Cerneala: negrul de câmp (`editorial.fieldDeep`) pe un cadru cu imagine. */
  color: string;
  anchor?: 'top' | 'bottom';
}) {
  if (!geometry || !(geometry.height > 0)) return null;
  const box = anchor === 'bottom'
    ? { left: 0, right: 0, bottom: 0, height: geometry.height }
    : { left: 0, right: 0, top: 0, height: geometry.height };
  return (
    <View pointerEvents="none" style={[styles.layer, box]}>
      {/**
       * Gradientul este definit în spațiul stratului, nu al cadrului (`x1/y1/x2/y2` pe `objectBoundingBox`
       * al unui `Svg` de 100%), deci aceleași opriri descriu aceeași tranziție oricât de înaltă ar fi
       * banda. `Rect` umple tot stratul: marginea lui de sus este chiar marginea benzii măsurate.
       */}
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {geometry.stops.map((stop, index) => (
              <Stop key={index} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Blocul de **cuvinte** al unei pagini, cu banda lui de citire desenată din măsurătoare.
 *
 * Este piesa care lipsea pe hârtie (runda 45): fluxul paginii așază cuvintele la locul lor, deci o bandă
 * ancorată la poale ar fi acoperit pagină goală. Aici banda se măsoară pe **copiii** primită și se desenează
 * înaintea lor (`lib/readability.ts::wordsScrim`), deci nu poate acoperi un cuvânt, un `Citește tot` sau un
 * tag, și nu ia nicio atingere.
 *
 * `flex: true` păstrează așezarea unui text paginat (care are nevoie de tot locul ca să pagineze); `false`
 * lasă blocul să-și ia doar înălțimea lui, ca banda să fie a cuvintelor, nu a paginii de sub ele.
 */
export function WordsBand({ id, color, frame, ground = 'paper', flex = false, band = true, style, onMeasure, children }: {
  id: string;
  color: string;
  /** Înălțimea cadrului, pentru penumbra proporțională. */
  frame: number;
  ground?: 'night' | 'paper';
  flex?: boolean;
  /** `false` când banda este desenată de altcineva (pagina de hârtie o desenează din rândurile ei). */
  band?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Ce a măsurat blocul, pentru suprafețele care trebuie să spună mai departe (compozitorul). */
  onMeasure?: (height: number) => void;
  children: React.ReactNode;
}) {
  const block = useBlockHeight();
  const geometry = band === false ? null : wordsScrim({ block: block.height, frame, ground });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    block.onLayout(event);
    onMeasure?.(Math.max(0, Math.round(event.nativeEvent.layout.height)));
  }, [block, onMeasure]);
  return (
    <View style={[flex ? styles.fill : styles.block, style]} onLayout={onLayout}>
      <PostScrim id={id} geometry={geometry} color={color} />
      {children}
    </View>
  );
}

/**
 * Înălțimea măsurată a unui bloc, ca valoare de stare.
 *
 * Este singurul mod în care compoziția află cât loc ia un cap sau o descriere: o măsurătoare `onLayout`
 * rotunjită la punct întreg, cu identitate stabilă pentru handler (un `onLayout` nou la fiecare randare ar
 * remonta stratul) și fără scrieri când numărul nu s-a schimbat (o scriere egală ar reda compoziția la
 * nesfârșit, pentru că scrim-ul depinde de valoarea pe care o scrie).
 */
export function useBlockHeight(): { height: number; onLayout: (event: LayoutChangeEvent) => void } {
  const [height, setHeight] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.max(0, Math.round(event.nativeEvent.layout.height));
    setHeight((previous) => (previous === next ? previous : next));
  }, []);
  return { height, onLayout };
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  /** Așezarea unui text paginat: își ia tot locul, fiindcă fluxul are nevoie de o înălțime. */
  fill: { flex: 1 },
  /** Așezarea unui text scurt: banda este a cuvintelor, nu a paginii goale de sub ele. */
  block: {},
});
