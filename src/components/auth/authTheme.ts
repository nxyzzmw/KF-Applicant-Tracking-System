import type { CSSProperties } from 'react'
import { COLORS } from '../../theme/color'

export type StrengthLevel = 'weak' | 'medium' | 'strong'

export type PasswordStrength = {
  score: number
  level: StrengthLevel
  label: string
  color: string
}

export const authThemeVars: CSSProperties & Record<string, string> = {
  '--bg': COLORS.pageBackground,
  '--surface': COLORS.surface,
  '--surface2': COLORS.surface2,
  '--border': COLORS.borderDefault,
  '--border-hover': COLORS.borderHover,
  '--accent': COLORS.accentBlue,
  '--accent2': COLORS.accentLightBlue,
  '--accent3': COLORS.accentRoyalBlue,
  '--accent-bright': COLORS.accentBrightBlue,
  '--text': COLORS.bodyText,
  '--muted': COLORS.mutedText2,
  '--muted2': COLORS.mutedText,
  '--error': COLORS.error,
  '--alert-info': COLORS.accentDeepBlue,
  '--grid-lines': COLORS.gridLines,
  '--bg-orb-1': COLORS.bgOrb1,
  '--bg-orb-2': COLORS.bgOrb2,
  '--bg-orb-3': COLORS.bgOrb3,
  '--strength-weak': COLORS.strengthWeak,
  '--strength-medium': COLORS.strengthMedium,
  '--strength-strong': COLORS.strengthStrong,
  '--btn-from': COLORS.buttonGradientFrom,
  '--btn-via': COLORS.buttonGradientVia,
  '--btn-to': COLORS.buttonGradientTo,
  '--btn-shadow': COLORS.buttonHoverShadow,
}

export function getPasswordStrength(value: string): PasswordStrength {
  if (!value) {
    return {
      score: 0,
      level: 'weak',
      label: 'Enter a password',
      color: COLORS.mutedText,
    }
  }

  let score = 0
  if (value.length >= 8) score += 1
  if (/[A-Z]/.test(value)) score += 1
  if (/[0-9]/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1

  const level: StrengthLevel = score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong'
  const labels = ['', 'Too weak', 'Needs work', 'Almost there', 'Strong']

  return {
    score,
    level,
    label: labels[score] || 'Strong',
    color:
      level === 'weak'
        ? COLORS.error
        : level === 'medium'
          ? COLORS.strengthMedium
          : COLORS.accentBrightBlue,
  }
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Expired'
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

export { COLORS }
