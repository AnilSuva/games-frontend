import { GAME_HEIGHT, GAME_WIDTH } from "../config/balance";

export interface LayoutMetrics {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscapeMobile: boolean;
}

/**
 * Computes responsive arena dimensions and breakpoint classifications
 * based on available container width and height.
 *
 * Guarantees:
 * 1. Mobile portrait: Uses full available width (edge-to-edge), height derived from exact 480:640 aspect ratio.
 * 2. Mobile landscape: Clamps height to available viewport, preventing any vertical overflow or scrolling.
 * 3. Tablet: Appropriately scaled up (up to 580px wide) with balanced margins.
 * 4. Desktop: Preserves the current polished centered 480x640 arcade unit.
 * 5. Aspect ratio (480:640) and circular collision geometry are always 100% preserved.
 */
export function computeArenaDimensions(w: number, h: number): LayoutMetrics {
  const isLandscapeMobile = h < 520 && w > h;
  const isMobile = (w < 640 || isLandscapeMobile) && !isLandscapeMobile;
  const isTablet = w >= 640 && w < 1024 && !isLandscapeMobile;
  const isDesktop = w >= 1024 && !isLandscapeMobile;

  if (isLandscapeMobile) {
    // In landscape mobile, height is the constraining dimension
    const availH = Math.max(h - 12, 100);
    const scale = Math.min((w - 24) / GAME_WIDTH, availH / GAME_HEIGHT);
    return {
      width: Math.floor(GAME_WIDTH * scale),
      height: Math.floor(GAME_HEIGHT * scale),
      isMobile: false,
      isTablet: false,
      isDesktop: false,
      isLandscapeMobile: true,
    };
  }

  if (isMobile) {
    // In portrait mobile: deduct compact top HUD (~44px) and bottom nav (~40px)
    const availH = Math.max(h - 84, 100);
    const scale = Math.min(w / GAME_WIDTH, availH / GAME_HEIGHT);
    return {
      width: Math.min(w, Math.floor(GAME_WIDTH * scale)),
      height: Math.floor(GAME_HEIGHT * scale),
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isLandscapeMobile: false,
    };
  }

  if (isTablet) {
    // Tablet: scale up nicely with balanced margins, max 580px width
    const availW = Math.max(w - 32, 100);
    const availH = Math.max(h - 48, 100);
    const scale = Math.min(availW / GAME_WIDTH, availH / GAME_HEIGHT, 580 / GAME_WIDTH);
    return {
      width: Math.floor(GAME_WIDTH * scale),
      height: Math.floor(GAME_HEIGHT * scale),
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isLandscapeMobile: false,
    };
  }

  // Desktop (>= 1024px): preserve current polished centered 480x640 layout
  const availH = Math.max(h - 40, 100);
  const scale = Math.min(GAME_WIDTH / GAME_WIDTH, availH / GAME_HEIGHT, 1.0);
  return {
    width: Math.floor(GAME_WIDTH * scale),
    height: Math.floor(GAME_HEIGHT * scale),
    isMobile: false,
    isTablet: false,
    isDesktop,
    isLandscapeMobile: false,
  };
}
