import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import styles from './ArticleStep.module.css';

type Option = { value: string; label: string };

interface ArticleStepProps {
    draftItem: {
        supplierLabel: string;
        tipoPrenda: string;
        codigoArticulo: string;
        curvaTalles: string;
    };
    supplierOptions: Option[];
    garmentTypeOptions: Option[];
    sizeCurveOptions: Option[];
    catalogsLoading: boolean;
    catalogsError: string | null;
    onChange: (field: string, value: string) => void;
    onNext: () => void;
    readOnly?: boolean;
}

const GARMENT_EMOJIS = ['👕', '👖', '🧥', '🩳', '🧢', '🧦', '🥾', '🎽', '🧤'];

export function ArticleStep({
    draftItem,
    supplierOptions,
    garmentTypeOptions,
    sizeCurveOptions,
    catalogsLoading,
    catalogsError,
    onChange,
    onNext,
    readOnly = false
}: ArticleStepProps) {
    const hasMissingCatalogs = supplierOptions.length === 0 || garmentTypeOptions.length === 0 || sizeCurveOptions.length === 0;
    const catalogBlockReason = catalogsError
        || (hasMissingCatalogs ? 'Faltan catálogos obligatorios. Primero debés crear Proveedores, Tipos de prenda y Curvas de talle desde Admin.' : null);

    const isValid = draftItem.supplierLabel && draftItem.tipoPrenda && draftItem.codigoArticulo && draftItem.curvaTalles && !catalogBlockReason;

    return (
        <section className={styles.wrapper}>
            <h2 className={styles.title}>Paso 1 · Datos del artículo</h2>
            <p className={styles.subtitle}>Seleccioná proveedor, tipo de prenda y curva.</p>

            <label className={styles.label}>Código de artículo</label>
            <input
                className={styles.input}
                value={draftItem.codigoArticulo}
                onChange={(e) => onChange('codigoArticulo', e.target.value)}
                placeholder="Ej: NK-1002"
                disabled={readOnly}
            />

            <h3 className={styles.blockTitle}>Proveedor</h3>
            <div className={styles.supplierGrid}>
                {supplierOptions.map((option) => {
                    const active = draftItem.supplierLabel === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={active ? styles.optionActive : styles.optionCard}
                            onClick={() => onChange('supplierLabel', option.value)}
                            disabled={readOnly || catalogsLoading}
                        >
                            {active && <CheckCircle2 size={17} className={styles.checkIcon} />}
                            <span className={styles.optionAvatar}>{option.label.charAt(0)}</span>
                            <span>{option.label}</span>
                        </button>
                    );
                })}
            </div>

            <h3 className={styles.blockTitle}>Tipo de prenda</h3>
            <div className={styles.garmentGrid}>
                {garmentTypeOptions.map((option, index) => {
                    const active = draftItem.tipoPrenda === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={active ? styles.garmentActive : styles.garmentCard}
                            onClick={() => onChange('tipoPrenda', option.value)}
                            disabled={readOnly || catalogsLoading}
                        >
                            <span>{GARMENT_EMOJIS[index % GARMENT_EMOJIS.length]}</span>
                            <span>{option.label}</span>
                        </button>
                    );
                })}
            </div>

            <h3 className={styles.blockTitle}>Curva de talles</h3>
            <div className={styles.curveList}>
                {sizeCurveOptions.map((option) => {
                    const active = draftItem.curvaTalles === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={active ? styles.curveActive : styles.curveCard}
                            onClick={() => onChange('curvaTalles', option.value)}
                            disabled={readOnly || catalogsLoading}
                        >
                            <span>{option.label}</span>
                        </button>
                    );
                })}
            </div>

            {catalogBlockReason && (
                <div className={styles.warning}>
                    <AlertCircle size={15} />
                    <div>
                        <p>{catalogBlockReason}</p>
                        <Link to="/admin">Ir a Administración de catálogos</Link>
                    </div>
                </div>
            )}

            <button
                onClick={onNext}
                disabled={!isValid || readOnly || catalogsLoading}
                className={styles.submitButton}
            >
                Continuar: agregar colores <ArrowRight size={16} />
            </button>
        </section>
    );
}
