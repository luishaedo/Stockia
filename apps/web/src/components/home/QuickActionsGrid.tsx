import { LucideIcon } from 'lucide-react';
import styles from './QuickActionsGrid.module.css';

interface QuickActionItem {
    key: string;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
}

interface QuickActionsGridProps {
    items: QuickActionItem[];
}

export function QuickActionsGrid({ items }: QuickActionsGridProps) {
    return (
        <div className={styles.grid}>
            {items.map(({ key, icon: Icon, label, onClick }) => (
                <button key={key} type="button" onClick={onClick} className={styles.actionButton}>
                    <span className={styles.iconWrap}>
                        <Icon size={28} />
                    </span>
                    <span className={styles.label}>{label}</span>
                </button>
            ))}
        </div>
    );
}
