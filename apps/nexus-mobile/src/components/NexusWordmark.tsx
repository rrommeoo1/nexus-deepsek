import { SvgXml } from 'react-native-svg';
import { nexusTokens } from '../theme/tokens';

const colouredTokens = ['#f4fbff', '#00efff', '#a66cff', '#27dfe9', '#9d72ff'];

/**
 * The wordmark on the Social feed is the same drawing, recoloured to one ink by the monochrome shell
 * (`feed-surface.css`: `.nexusWordmarkSvg :is(text,circle){fill:currentColor}`,
 * `stop{stop-color:currentColor}`, `path{stroke:currentColor}`). React Native has no CSS cascade, so
 * the equivalent is applied to the markup, which keeps the drawing itself untouched.
 */
function paintSingleInk(xml: string, ink: string): string {
  let result = xml;
  for (const token of colouredTokens) {
    result = result.split(token).join(ink);
  }
  return result;
}

export function NexusWordmark({ width = 200, ink }: { width?: number; ink?: string }) {
  const xml = ink ? paintSingleInk(nexusTokens.graphics.wordmarkSvg, ink) : nexusTokens.graphics.wordmarkSvg;
  return <SvgXml xml={xml} width={width} height={width * 34 / 132} />;
}

