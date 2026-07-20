import { useTheme } from '../context/ThemeContext';

/** Theme-aware brand lockup — swaps text color per mode so it always reads clean. */
export function Logo({ height = 22 }: { height?: number }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/brand/tide-logo-white-text.png' : '/brand/tide-logo-black-text.png';
  return <img src={src} alt="Tide Events Group Scotland" height={height} style={{ display: 'block' }} />;
}
