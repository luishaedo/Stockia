import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export function Button({
    className,
    variant = 'primary',
    size = 'md',
    isLoading,
    icon,
    children,
    disabled,
    ...props
}: ButtonProps) {
    const iconOnly = variant === 'icon';

    return (
        <button
            className={clsx(
                styles.button,
                styles[variant],
                styles[size],
                iconOnly && styles.iconOnly,
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className={styles.spinner} />}
            {!isLoading && icon && <span className={styles.icon}>{icon}</span>}
            {!iconOnly && children}
        </button>
    );
}
