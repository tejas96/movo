import Svg, { Path } from 'react-native-svg';
import { wordmark } from './generated/wordmark-data';
import { theme } from './theme';

export interface WordmarkProps {
  /** Rendered width in dp. Height follows the letterforms. */
  width?: number;
  color?: string;
}

/** Height of the wordmark for a given width, so layouts can reserve the space. */
export function wordmarkHeight(width: number): number {
  return (width * wordmark.height) / wordmark.width;
}

/** The "movo" wordmark, Poppins SemiBold as outlines. Use it where the brand speaks: splash, welcome, login. */
export function Wordmark({ width = 120, color = theme.color.text.primary }: WordmarkProps) {
  return (
    <Svg
      width={width}
      height={wordmarkHeight(width)}
      viewBox={`0 0 ${wordmark.width} ${wordmark.height}`}
      accessibilityRole="image"
      accessibilityLabel={wordmark.word}
    >
      {wordmark.letters.map((letter, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static letters, fixed order
        <Path key={i} d={letter.d} fill={color} />
      ))}
    </Svg>
  );
}

export { wordmark } from './generated/wordmark-data';
