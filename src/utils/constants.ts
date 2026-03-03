import { COLORS } from '../theme/color'

export const APP_THEME = {
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontWeight: {
    bodyLight: 300,
    bodyRegular: 400,
    bodyMedium: 500,
    bodySemibold: 600,
    headingBold: 700,
    headingExtrabold: 800,
  },
  colors: COLORS,
} as const

export const UI_GRADIENTS = {
  primaryButton: `linear-gradient(135deg, ${COLORS.buttonGradientFrom}, ${COLORS.buttonGradientVia}, ${COLORS.buttonGradientTo})`,
} as const
