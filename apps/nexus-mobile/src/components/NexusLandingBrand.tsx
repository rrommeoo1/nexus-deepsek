import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { nexusTokens } from '../theme/tokens';

const source = nexusTokens.login.brand;
const radians = source.cssGlyph.angleDeg * Math.PI / 180;
const dx = Math.sin(radians) * 50;
const dy = -Math.cos(radians) * 50;

/** SVG transcription of the exact .landing .brand::before CSS glyph. */
export function NexusLandingBrand() {
  const shape = source.cssGlyph.clipPath.match(/\d+/g)?.map(Number);
  if (!shape || shape.length !== 20) throw new Error('Invalid source glyph polygon');
  const points = Array.from({ length: 10 }, (_, index) =>
    `${shape[index * 2] * source.cssGlyph.width / 100},${shape[index * 2 + 1] * source.cssGlyph.height / 100}`,
  ).join(' ');
  return (
    <View style={styles.row}>
      <Svg width={source.cssGlyph.width} height={source.cssGlyph.height} viewBox="0 0 40 40">
        <Defs>
          <LinearGradient id="landing-brand-glyph"
            x1={`${50 - dx}%`} y1={`${50 - dy}%`} x2={`${50 + dx}%`} y2={`${50 + dy}%`}>
            {source.cssGlyph.gradient.map((color, index) => (
              <Stop key={index} offset={source.cssGlyph.stops[index]} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Polygon points={points} fill="url(#landing-brand-glyph)" />
      </Svg>
      <Text style={styles.text}>NEXUS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: source.height, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: source.gap },
  text: { color: nexusTokens.colors.white, fontSize: source.fontSize,
    fontWeight: source.fontWeight, letterSpacing: source.letterSpacing },
});
