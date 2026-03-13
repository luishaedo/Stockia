import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import styles from './ArticleStep.module.css';

type Option = { value: string; label: string };

interface ArticleStepProps {
    draftItem: {
        familyId: string;
        categoryId: string;
        garmentTypeId: string;
        classificationId: string;
        materialId: string;
        codigoArticulo: string;
        curvaTalles: string;
    };
    familyOptions: Option[];
    categoryOptions: Option[];
    garmentTypeOptions: Option[];
    classificationOptions: Option[];
    materialOptions: Option[];
    sizeCurveOptions: Option[];
    catalogsLoading: boolean;
    catalogsError: string | null;
    onChange: (field: string, value: string) => void;
    onNext: () => void;
    readOnly?: boolean;
}

export function ArticleStep({
    draftItem,
    familyOptions,
    categoryOptions,
    garmentTypeOptions,
    classificationOptions,
    materialOptions,
    sizeCurveOptions,
    catalogsLoading,
    catalogsError,
    onChange,
    onNext,
    readOnly = false
}: ArticleStepProps) {
    const hasMissingCatalogs = [
        familyOptions,
        categoryOptions,
        garmentTypeOptions,
        classificationOptions,
        materialOptions,
        sizeCurveOptions
    ].some((options) => options.length === 0);

    const catalogBlockReason = catalogsError
        || (hasMissingCatalogs ? 'Faltan catálogos obligatorios para cargar el artículo. Revisá Administración.' : null);

    const isValid = Boolean(
        draftItem.familyId
        && draftItem.categoryId
        && draftItem.garmentTypeId
        && draftItem.classificationId
        && draftItem.materialId
        && draftItem.curvaTalles
        && draftItem.codigoArticulo
        && !catalogBlockReason
    );

    return (
        <section className={styles.wrapper}>
            <h2 className={styles.title}>Paso 1 · Datos del artículo</h2>
            <p className={styles.subtitle}>Seleccioná Familia, Categoría, Tipo, Clasificación, Material, Curva y luego SKU.</p>

            <label className={styles.label}>Familia</label>
            <select className={styles.input} value={draftItem.familyId} onChange={(e) => onChange('familyId', e.target.value)} disabled={readOnly || catalogsLoading}>
                <option value="">Seleccionar familia</option>
                {familyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className={styles.label}>Categoría</label>
            <select className={styles.input} value={draftItem.categoryId} onChange={(e) => onChange('categoryId', e.target.value)} disabled={readOnly || catalogsLoading}>
                <option value="">Seleccionar categoría</option>
                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className={styles.label}>Tipo</label>
            <select className={styles.input} value={draftItem.garmentTypeId} onChange={(e) => onChange('garmentTypeId', e.target.value)} disabled={readOnly || catalogsLoading}>
                <option value="">Seleccionar tipo</option>
                {garmentTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className={styles.label}>Clasificación</label>
            <select className={styles.input} value={draftItem.classificationId} onChange={(e) => onChange('classificationId', e.target.value)} disabled={readOnly || catalogsLoading}>
                <option value="">Seleccionar clasificación</option>
                {classificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className={styles.label}>Material</label>
            <select className={styles.input} value={draftItem.materialId} onChange={(e) => onChange('materialId', e.target.value)} disabled={readOnly || catalogsLoading}>
                <option value="">Seleccionar material</option>
                {materialOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className={styles.label}>Curva de talles</label>
            <select className={styles.input} value={draftItem.curvaTalles} onChange={(e) => onChange('curvaTalles', e.target.value)} disabled={readOnly || catalogsLoading}>
                <option value="">Seleccionar curva</option>
                {sizeCurveOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className={styles.label}>SKU</label>
            <input
                className={styles.input}
                value={draftItem.codigoArticulo}
                onChange={(e) => onChange('codigoArticulo', e.target.value)}
                placeholder="Ej: NK-1002"
                disabled={readOnly}
            />

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
