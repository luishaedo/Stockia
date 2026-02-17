import React from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
}

export function Card({ className, title, children, ...props }: CardProps) {
    return (
        <div className={clsx(styles.card, className)} {...props}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {children}
        </div>
    );
}
