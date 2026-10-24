import { Image } from 'react-native';
import { GlowAvatar, toneFor } from './drawings/GlowAvatar';

export interface AvatarProps {
  name: string;
  uri?: string | null | undefined;
  size?: 32 | 40 | 44 | 56 | 64;
  /** Old option, no longer used: initials always sit on a soft colour glow. */
  tone?: 'white' | 'gray';
  className?: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

/** The photo when there is one, else the initials on a soft colour glow (Soft Glow avatar). */
export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={dims} accessibilityLabel={name} />;
  return <GlowAvatar initials={initialsOf(name)} size={size} tone={toneFor(name)} />;
}
