import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
}

function Button({ children, className = '', variant = 'primary', size = 'md', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`ui-btn ui-btn--${variant} ui-btn--${size}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  )
}

export default Button
