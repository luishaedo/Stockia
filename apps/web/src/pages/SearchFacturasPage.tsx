import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FacturaEstado, FacturaFilters, FacturaListResponse, InvoicesByArticleResponse } from '@stockia/shared';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../services/api';
import styles from './SearchFacturasPage.module.css';

type InvoiceLine = InvoicesByArticleResponse['invoices'][number]['lines'][number];
type InvoiceLineVariant = InvoiceLine['variants'][number];

const hasAnyQuantity = (variant: InvoiceLineVariant) => Object.values(variant.cantidadesPorTalle).some((qty) => Number(qty) > 0);

const formatVariantQuantities = (variant: InvoiceLineVariant) => Object.entries(variant.cantidadesPorTalle)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([size, qty]) => ({ size, qty }));

const getVisibleCurveSizes = (line: InvoiceLine) => {
    const sizesWithQty = new Set<string>();

    line.variants.forEach((variant) => {
        Object.entries(variant.cantidadesPorTalle).forEach(([size, qty]) => {
            if (Number(qty) > 0) {
                sizesWithQty.add(size);
            }
        });
    });

    return line.curvaTalles.filter((size) => sizesWithQty.has(size));
};

export function SearchFacturasPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [hasFacturaSearch, setHasFacturaSearch] = useState(false);
    const [facturaLoading, setFacturaLoading] = useState(false);

    const [articleSearch, setArticleSearch] = useState<InvoicesByArticleResponse | null>(null);
    const [articleQuery, setArticleQuery] = useState('');
    const [articleError, setArticleError] = useState<string | null>(null);
    const [hasArticleSearch, setHasArticleSearch] = useState(false);
    const [articleLoading, setArticleLoading] = useState(false);

    const [filters, setFilters] = useState<FacturaFilters>({ page: 1, pageSize: 10, sortBy: 'fecha', sortDir: 'desc' });

    const runSearch = async () => {
        setFacturaLoading(true);
        setHasFacturaSearch(true);
        try {
            const result = await api.getFacturas(filters);
            setData(result);
        } finally {
            setFacturaLoading(false);
        }
    };

    const runArticleSearch = async () => {
        const normalizedArticleQuery = articleQuery.trim();
        if (!normalizedArticleQuery) {
            setHasArticleSearch(true);
            setArticleError('Ingresá un SKU (o parte del SKU) para buscar facturas asociadas.');
            setArticleSearch(null);
            return;
        }

        setArticleLoading(true);
        setHasArticleSearch(true);
        setArticleError(null);
        try {
            const result = await api.getInvoicesByArticle(normalizedArticleQuery);
            setArticleSearch(result);
        } catch (error) {
            setArticleSearch(null);
            setArticleError(error instanceof Error ? error.message : 'No pudimos buscar facturas por artículo.');
        } finally {
            setArticleLoading(false);
        }
    };

    const invoiceResultsCount = data?.items.length ?? 0;
    const articleResultsCount = articleSearch?.invoices.length ?? 0;

    const articleResults = useMemo(() => articleSearch?.invoices ?? [], [articleSearch]);

    return (
        <section>
            <header className={styles.hero}>
                <button type="button" className={styles.backButton} onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
                <h1>Buscar facturas</h1>
                <p>Encontrá facturas por filtros o por SKU de artículo.</p>
            </header>

            <div className={styles.formCard}>
                <label>Nro. factura</label>
                <div className={styles.searchInput}><Search size={16} /><input placeholder="Buscar por número..." value={filters.nroFactura || ''} onChange={(event) => setFilters({ ...filters, nroFactura: event.target.value })} /></div>
                <label>Proveedor</label>
                <input className={styles.input} placeholder="Nombre del proveedor" value={filters.proveedor || ''} onChange={(event) => setFilters({ ...filters, proveedor: event.target.value })} />
                <label>Estado</label>
                <select className={styles.input} value={filters.estado || ''} onChange={(event) => setFilters({ ...filters, estado: (event.target.value as FacturaEstado) || undefined })}>
                    <option value="">Todos</option>
                    <option value={FacturaEstado.DRAFT}>Borrador</option>
                    <option value={FacturaEstado.FINAL}>Final</option>
                </select>
                <div className={styles.dateGrid}>
                    <div>
                        <label>Desde</label>
                        <input className={styles.input} type="date" onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value ? new Date(`${event.target.value}T00:00:00.000Z`).toISOString() : undefined })} />
                    </div>
                    <div>
                        <label>Hasta</label>
                        <input className={styles.input} type="date" onChange={(event) => setFilters({ ...filters, dateTo: event.target.value ? new Date(`${event.target.value}T23:59:59.999Z`).toISOString() : undefined })} />
                    </div>
                </div>
                <button className={styles.cleanButton} onClick={() => setFilters({ page: 1, pageSize: 10, sortBy: 'fecha', sortDir: 'desc' })}>Limpiar filtros</button>
                <button className={styles.searchButton} onClick={() => void runSearch()}>Buscar facturas</button>
            </div>

            <div className={styles.formCard}>
                <label>SKU de artículo</label>
                <div className={styles.searchInput}>
                    <Search size={16} />
                    <input
                        placeholder="Ej: 101 o 10146"
                        value={articleQuery}
                        onChange={(event) => setArticleQuery(event.target.value)}
                    />
                </div>
                <button className={styles.searchButton} onClick={() => void runArticleSearch()}>Buscar SKU en facturas</button>
                {articleError && <p className={styles.error}>{articleError}</p>}
            </div>

            <section className={styles.resultsSection}>
                <h2 className={styles.resultsTitle}>Resultados de facturas {hasFacturaSearch ? `(${invoiceResultsCount})` : ''}</h2>
                {!hasFacturaSearch && <p className={styles.emptyState}>Todavía no hiciste una búsqueda de facturas.</p>}
                {hasFacturaSearch && facturaLoading && <p className={styles.emptyState}>Cargando facturas...</p>}
                {hasFacturaSearch && !facturaLoading && invoiceResultsCount === 0 && <p className={styles.emptyState}>No encontramos facturas con esos filtros.</p>}
                {hasFacturaSearch && !facturaLoading && invoiceResultsCount > 0 && (
                    <div className={styles.resultsList}>
                        {data?.items.map((factura) => (
                            <button key={factura.id} type="button" className={styles.resultCard} onClick={() => navigate(factura.estado === FacturaEstado.DRAFT ? `/facturas/${factura.id}/wizard` : `/facturas/${factura.id}/summary`)}>
                                <div className={styles.resultTop}><span>{new Intl.DateTimeFormat('es-AR').format(new Date(factura.fecha))}</span><span className={factura.estado === FacturaEstado.DRAFT ? styles.badgeDraft : styles.badgeFinal}>{factura.estado === FacturaEstado.DRAFT ? 'Borrador' : 'Final'}</span></div>
                                <strong>{factura.nroFactura}</strong>
                                <p>{factura.proveedor || 'Sin proveedor'}</p>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className={styles.resultsSection}>
                <h2 className={styles.resultsTitle}>Resultados de SKU {hasArticleSearch ? `(${articleResultsCount} factura/s)` : ''}</h2>
                {!hasArticleSearch && <p className={styles.emptyState}>Buscá un SKU para ver en qué facturas aparece.</p>}
                {hasArticleSearch && articleLoading && <p className={styles.emptyState}>Buscando SKU en facturas...</p>}
                {hasArticleSearch && !articleLoading && !articleError && articleResultsCount === 0 && (
                    <p className={styles.emptyState}>No encontramos resultados para este SKU.</p>
                )}

                {hasArticleSearch && !articleLoading && articleResultsCount > 0 && (
                    <div className={styles.invoiceCardsList}>
                        {articleResults.map((invoice) => (
                            <article key={invoice.invoiceId} className={styles.invoiceCard}>
                                <header className={styles.invoiceHeader}>
                                    <div>
                                        <p className={styles.invoiceLabel}>Factura</p>
                                        <strong className={styles.invoiceNumber}>{invoice.invoiceNumber}</strong>
                                    </div>
                                    <div className={styles.invoiceHeaderMeta}>
                                        <span>{new Intl.DateTimeFormat('es-AR').format(new Date(invoice.date))}</span>
                                        <span className={invoice.status === FacturaEstado.DRAFT ? styles.badgeDraft : styles.badgeFinal}>
                                            {invoice.status === FacturaEstado.DRAFT ? 'Borrador' : 'Final'}
                                        </span>
                                    </div>
                                </header>

                                <div className={styles.lineList}>
                                    {invoice.lines.map((line) => {
                                        const visibleCurveSizes = getVisibleCurveSizes(line);

                                        return (
                                            <article key={line.itemId} className={styles.lineCard}>
                                                <div className={styles.lineHeader}>
                                                    <strong>{line.codigoArticulo}</strong>
                                                    <span>{line.description}</span>
                                                </div>

                                                <div className={styles.curveBlock}>
                                                    <p className={styles.curveLabel}>Curva cargada</p>
                                                    {visibleCurveSizes.length === 0 ? (
                                                        <p className={styles.emptyCurveText}>Sin talles con cantidad cargada.</p>
                                                    ) : (
                                                        <div className={styles.chipsWrap}>
                                                            {visibleCurveSizes.map((size) => (
                                                                <span key={`${line.itemId}-${size}`} className={styles.sizeChip}>{size}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className={styles.variantList}>
                                                    {line.variants.filter(hasAnyQuantity).map((variant) => (
                                                        <div key={`${line.itemId}-${variant.codigoColor}`} className={styles.variantCard}>
                                                            <p className={styles.variantTitle}>{variant.nombreColor} ({variant.codigoColor})</p>
                                                            <div className={styles.chipsWrap}>
                                                                {formatVariantQuantities(variant).map(({ size, qty }) => (
                                                                    <span key={`${line.itemId}-${variant.codigoColor}-${size}`} className={styles.quantityChip}>
                                                                        {size} · {qty}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
}
