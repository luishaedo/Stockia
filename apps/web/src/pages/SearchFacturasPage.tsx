import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FacturaEstado, FacturaFilters, FacturaListResponse, InvoicesByArticleResponse } from '@stockia/shared';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../services/api';
import styles from './SearchFacturasPage.module.css';

export function SearchFacturasPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [articleSearch, setArticleSearch] = useState<InvoicesByArticleResponse | null>(null);
    const [articleQuery, setArticleQuery] = useState('');
    const [articleError, setArticleError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<FacturaFilters>({ page: 1, pageSize: 10, sortBy: 'fecha', sortDir: 'desc' });

    const runSearch = async () => {
        setLoading(true);
        try {
            const result = await api.getFacturas(filters);
            setData(result);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void runSearch(); }, []);

    const runArticleSearch = async () => {
        const normalizedArticleQuery = articleQuery.trim();
        if (!normalizedArticleQuery) {
            setArticleError('Ingresá un SKU (o parte del SKU) para buscar facturas asociadas.');
            setArticleSearch(null);
            return;
        }

        setLoading(true);
        setArticleError(null);
        try {
            const result = await api.getInvoicesByArticle(normalizedArticleQuery);
            setArticleSearch(result);
        } catch (error) {
            setArticleSearch(null);
            setArticleError(error instanceof Error ? error.message : 'No pudimos buscar facturas por artículo.');
        } finally {
            setLoading(false);
        }
    };

    const getSizesAboveOneFromVariants = (variants: InvoicesByArticleResponse['invoices'][number]['lines'][number]['variants']) => {
        const sizesWithQtyAboveOne = new Set<string>();

        for (const variant of variants) {
            for (const [size, qty] of Object.entries(variant.cantidadesPorTalle)) {
                if (Number(qty) > 1) {
                    sizesWithQtyAboveOne.add(size);
                }
            }
        }

        return sizesWithQtyAboveOne;
    };

    return (
        <section>
            <header className={styles.hero}>
                <button type="button" className={styles.backButton} onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
                <h1>Buscar facturas</h1>
                <p>Filtros avanzados de búsqueda</p>
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
                <button className={styles.searchButton} onClick={() => void runSearch()}>Buscar</button>
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

            <h2 className={styles.resultsTitle}>Resultados ({data?.items?.length || 0})</h2>
            <div className={styles.resultsList}>
                {loading && <p>Cargando...</p>}
                {data?.items.map((factura) => (
                    <button key={factura.id} type="button" className={styles.resultCard} onClick={() => navigate(factura.estado === FacturaEstado.DRAFT ? `/facturas/${factura.id}/wizard` : `/facturas/${factura.id}/summary`)}>
                        <div className={styles.resultTop}><span>{new Intl.DateTimeFormat('es-AR').format(new Date(factura.fecha))}</span><span className={factura.estado === FacturaEstado.DRAFT ? styles.badgeDraft : styles.badgeFinal}>{factura.estado === FacturaEstado.DRAFT ? 'Borrador' : 'Final'}</span></div>
                        <strong>{factura.nroFactura}</strong>
                        <p>{factura.proveedor || 'Sin proveedor'}</p>
                    </button>
                ))}
            </div>

            {articleSearch && (
                <>
                    <h2 className={styles.resultsTitle}>
                        SKU "{articleSearch.query.term}" ({articleSearch.invoices.length} factura/s)
                    </h2>
                    <div className={styles.resultsList}>
                        {articleSearch.invoices.map((invoice) => (
                            <article key={invoice.invoiceId} className={styles.resultCard}>
                                <div className={styles.resultTop}>
                                    <span>{new Intl.DateTimeFormat('es-AR').format(new Date(invoice.date))}</span>
                                    <span>{invoice.invoiceNumber}</span>
                                    <span className={invoice.status === FacturaEstado.DRAFT ? styles.badgeDraft : styles.badgeFinal}>
                                        {invoice.status === FacturaEstado.DRAFT ? 'Borrador' : 'Final'}
                                    </span>
                                </div>
                                {invoice.lines.map((line) => (
                                    <div key={line.itemId} className={styles.articleLine}>
                                        {(() => {
                                            const sizesAboveOne = getSizesAboveOneFromVariants(line.variants);
                                            const filteredCurveSizes = line.curvaTalles.filter((size) => sizesAboveOne.has(size));

                                            return (
                                                <>
                                                    <strong>{line.codigoArticulo}</strong>
                                                    <span>
                                                        Curva: {filteredCurveSizes.length > 0 ? filteredCurveSizes.join(', ') : 'Sin talles con cantidad mayor a 1'}
                                                    </span>
                                                    {line.variants.map((variant) => {
                                                        const filteredQuantities = Object.entries(variant.cantidadesPorTalle).filter(([, qty]) => Number(qty) > 1);
                                                        if (filteredQuantities.length === 0) return null;

                                                        return (
                                                            <p key={`${line.itemId}-${variant.codigoColor}`}>
                                                                {variant.nombreColor} ({variant.codigoColor}) · {filteredQuantities.map(([size, qty]) => `${size}: ${qty}`).join(' · ')}
                                                            </p>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </article>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
