import { ChevronRight } from 'lucide-react';
import { Factura, FacturaEstado } from '@stockia/shared';
import styles from './PendingTasksList.module.css';

interface PendingTasksListProps {
    items: Factura[];
    onOpenDraft: (factura: Factura) => void;
    onOpenSummary: (factura: Factura) => void;
}

export function PendingTasksList({ items, onOpenDraft, onOpenSummary }: PendingTasksListProps) {
    return (
        <section>
            <h2 className={styles.heading}>Tareas</h2>
            <div className={styles.list}>
                {items.map((factura) => {
                    const isDraft = factura.estado === FacturaEstado.DRAFT;
                    return (
                        <article key={factura.id} className={styles.taskCard}>
                            <div className={styles.headerRow}>
                                <p className={styles.meta}>{new Intl.DateTimeFormat('es-AR').format(new Date(factura.fecha))}</p>
                                <span className={isDraft ? styles.badgeDraft : styles.badgeFinal}>{isDraft ? 'Borrador' : 'Final'}</span>
                            </div>
                            <h3 className={styles.title}>{factura.nroFactura}</h3>
                            <div className={styles.subtitleRow}>
                                <p className={styles.description}>{factura.proveedor || 'Sin proveedor'}</p>
                                <span className={styles.itemsCount}>{factura.items?.length || 0} items</span>
                            </div>
                            <button
                                type="button"
                                className={styles.cta}
                                onClick={() => (isDraft ? onOpenDraft(factura) : onOpenSummary(factura))}
                            >
                                {isDraft ? 'Continuar' : 'Ver detalle'} <ChevronRight size={16} />
                            </button>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
