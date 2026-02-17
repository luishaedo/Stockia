import React from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className={styles.container}>
                {label && <label className={styles.label}>{label}</label>}
                <input
                    ref={ref}
                    className={clsx(styles.input, error && styles.error, className)}
                    {...props}
                />
                {error && <span className={styles.errorMessage}>{error}</span>}
            </div>
        );
    }
);

Input.displayName = "Input";
