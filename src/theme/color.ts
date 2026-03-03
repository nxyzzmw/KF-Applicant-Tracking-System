export const COLORS = {
  // Core theme
  pageBackground: '#eef5ff',
  surface: '#ffffff',
  surface2: '#eaf2ff',
  surface3: '#edf4ff',
  surface4: '#f7faff',
  surface5: '#f8fbff',
  borderDefault: 'rgba(37,99,235,0.16)',
  borderHover: 'rgba(37,99,235,0.34)',
  accentBlue: '#4f9eff',
  accentLightBlue: '#7ec8ff',
  accentRoyalBlue: '#3b82f6',
  accentBrightBlue: '#60a5fa',
  accentDeepBlue: '#1e40af',
  accentMidBlue: '#2563eb',
  buttonGradientFrom: '#1e40af',
  buttonGradientVia: '#2563eb',
  buttonGradientTo: '#3b82f6',
  buttonText: '#ffffff',
  buttonHoverShadow: 'rgba(37,99,235,0.45)',
 
  // Text
  bodyText: '#10213f',
  mutedText: '#587099',
  mutedText2: '#6d84a8',
  textOnAvatar: '#0e172b',
 
  // Semantic
  error: '#e11d48',
  alertInfo: '#93c5fd',
  success: '#34d46d',
  successAlt: '#31ca67',
  warning: '#f5be3d',
  neutralStatus: '#90a4c0',
 
  // Charts and progress
  gridLines: 'rgba(37,99,235,0.08)',
  bgOrb1: 'rgba(79,158,255,0.20)',
  bgOrb2: 'rgba(30,80,180,0.18)',
  bgOrb3: 'rgba(100,180,255,0.16)',
  strengthWeak: '#ff6b8a',
  strengthMedium: '#fbbf24',
  strengthStrong: '#3b82f6',
 
  // Extra UI tones currently used in app screens
  avatarGradientFrom: '#ecd5b8',
  avatarGradientTo: '#b6845a',
  toggleKnobOff: '#d5def0',
  statusOpenBg: 'rgba(52,212,109,0.12)',
  statusOpenBgAlt: 'rgba(52,212,109,0.14)',
  statusOpenBorder: 'rgba(52,212,109,0.25)',
  statusHoldBg: 'rgba(245,190,61,0.15)',
  statusClosedBg: 'rgba(144,164,192,0.16)',
  whiteSoft: 'rgba(255,255,255,0.95)',
  whiteSoftAlt: 'rgba(255,255,255,0.96)',
  whiteOverlay: 'rgba(255,255,255,0.60)',
  surfaceOverlay: 'rgba(239,246,255,0.98)',
  accentGlowSoft: 'rgba(126,200,255,0.30)',
  accentGlowBorder: 'rgba(126,200,255,0.35)',
  accentOverlay20: 'rgba(30,99,235,0.20)',
  accentOverlay70: 'rgba(30,99,235,0.70)',
  brandOverlay08: 'rgba(79,158,255,0.08)',
  brandOverlay10: 'rgba(79,158,255,0.10)',
  brandOverlay12: 'rgba(79,158,255,0.12)',
  brandOverlay14: 'rgba(79,158,255,0.14)',
  brandOverlay16: 'rgba(79,158,255,0.16)',
  brandOverlay18: 'rgba(79,158,255,0.18)',
  brandOverlay20: 'rgba(79,158,255,0.20)',
  brandOverlay25: 'rgba(79,158,255,0.25)',
  brandOverlay32: 'rgba(79,158,255,0.32)',
  brandOverlay45: 'rgba(79,158,255,0.45)',
} as const
 
export type ColorToken = keyof typeof COLORS
 
 