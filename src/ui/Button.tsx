import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary';
  readonly size?: 'regular' | 'small';
  readonly children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'regular',
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = ['button'];
  if (variant === 'secondary') classes.push('button--secondary');
  if (size === 'small') classes.push('button--small');
  if (className) classes.push(className);
  return (
    <button type={type} className={classes.join(' ')} {...props}>
      <span>{children}</span>
    </button>
  );
}

type IconName =
  | 'close'
  | 'fire_front'
  | 'fire_left'
  | 'fire_right'
  | 'forward'
  | 'home'
  | 'minus'
  | 'pause'
  | 'play'
  | 'plus'
  | 'restart'
  | 'settings'
  | 'turn_left'
  | 'turn_right';

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon: IconName;
  readonly label: string;
  readonly size?: number;
}

export function RoundButton({
  icon,
  label,
  size,
  style,
  type = 'button',
  ...props
}: RoundButtonProps) {
  return (
    <button
      type={type}
      className="round-button"
      aria-label={label}
      title={label}
      style={size ? { ...style, ['--round-size' as string]: `${size}px` } : style}
      {...props}
    >
      <img src={`/assets/png/retina/ui/controls/icon_${icon}.png`} alt="" draggable={false} />
    </button>
  );
}
