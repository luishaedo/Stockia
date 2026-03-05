import { Factura } from '@stockia/shared';
import styles from './PendingTasksList.module.css';

interface PendingTasksListProps {
    items: Factura[];
    onOpenDraft: (factura: Factura) => void;
    onOpenSummary: (factura: Factura) => void;
}

export function PendingTasksList({ items, onOpenDraft, onOpenSummary }: PendingTasksListProps) {
    return (
        <section>
            <h2 className={styles.heading}>Pending Tasks</h2>
            <div className={styles.list}>
                {items.map((factura) => {
                    const isDraft = factura.estado !== 'FINAL';
                    return (
                        <article key={factura.id} className={styles.taskCard}>
                            <div>
                                <p className={styles.meta}>{new Intl.DateTimeFormat('es-AR').format(new Date(factura.fecha))}</p>
                                <h3 className={styles.title}>{factura.nroFactura}</h3>
                                <p className={styles.description}>{factura.proveedor || 'Sin proveedor asignado'}</p>
                            </div>
                            <button
                                type="button"
                                className={styles.cta}
                                onClick={() => (isDraft ? onOpenDraft(factura) : onOpenSummary(factura))}
                            >
                                {isDraft ? 'Continue' : 'Review'}
                            </button>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
