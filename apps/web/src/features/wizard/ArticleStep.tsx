import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
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

type AttributeStep = {
    key: keyof ArticleStepProps['draftItem'];
    title: string;
    placeholder: string;
    options: Option[];
    icon: string;
};

const SYMBOLS = ['🧩', '👕', '🏷️', '✅', '🧶', '📏', '🔢'];

const formatOptionLabel = (label: string) => {
    const [code, ...rest] = label.split(' - ');
    const name = rest.join(' - ').trim();
    return {
        code: code.trim(),
        name: name || code.trim()
    };
};

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
    const attributeSteps = useMemo<AttributeStep[]>(() => ([
        { key: 'familyId', title: 'Familia', placeholder: 'Seleccionar familia', options: familyOptions, icon: '👪' },
        { key: 'categoryId', title: 'Categoría', placeholder: 'Seleccionar categoría', options: categoryOptions, icon: '🗂️' },
        { key: 'garmentTypeId', title: 'Tipo de prenda', placeholder: 'Seleccionar tipo', options: garmentTypeOptions, icon: '👕' },
        { key: 'classificationId', title: 'Clasificación', placeholder: 'Seleccionar clasificación', options: classificationOptions, icon: '🏷️' },
        { key: 'materialId', title: 'Material', placeholder: 'Seleccionar material', options: materialOptions, icon: '🧶' },
        { key: 'curvaTalles', title: 'Curva de talles', placeholder: 'Seleccionar curva', options: sizeCurveOptions, icon: '📏' }
    ]), [familyOptions, categoryOptions, garmentTypeOptions, classificationOptions, materialOptions, sizeCurveOptions]);

    const [activeStepIndex, setActiveStepIndex] = useState(0);

    useEffect(() => {
        const firstEmptyIndex = attributeSteps.findIndex((step) => !draftItem[step.key]);
        if (firstEmptyIndex >= 0) {
            setActiveStepIndex(firstEmptyIndex);
            return;
        }

        setActiveStepIndex(attributeSteps.length - 1);
    }, [
        attributeSteps,
        draftItem.familyId,
        draftItem.categoryId,
        draftItem.garmentTypeId,
        draftItem.classificationId,
        draftItem.materialId,
        draftItem.curvaTalles
    ]);

    const hasMissingCatalogs = attributeSteps.some((step) => step.options.length === 0);

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

    const activeStep = attributeSteps[activeStepIndex];

    const handleSelectOption = (field: string, value: string) => {
        onChange(field, value);
        if (activeStepIndex < attributeSteps.length - 1) {
            setActiveStepIndex((prev) => prev + 1);
        }
    };

    const goBack = () => {
        setActiveStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const selectedValue = draftItem[activeStep.key] as string;

    return (
        <section className={styles.wrapper}>
            <h2 className={styles.title}>Paso 1 · Datos del artículo</h2>
            <p className={styles.subtitle}>Seleccioná cada atributo tocando una card. Al elegir, avanzás al siguiente paso.</p>

            <div className={styles.progressRow}>
                {attributeSteps.map((step, index) => {
                    const isDone = Boolean(draftItem[step.key]);
                    const isActive = index === activeStepIndex;
                    return (
                        <span key={step.key} className={isActive ? styles.progressActive : styles.progressItem}>
                            {isDone ? <CheckCircle2 size={14} /> : <span>{index + 1}</span>}
                        </span>
                    );
                })}
            </div>

            <div className={styles.stepHeader}>
                <button type="button" className={styles.backButton} onClick={goBack} disabled={activeStepIndex === 0 || readOnly || catalogsLoading}>
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <p className={styles.stepCounter}>Atributo {activeStepIndex + 1} de {attributeSteps.length}</p>
                    <h3 className={styles.blockTitle}>{activeStep.icon} {activeStep.title}</h3>
                </div>
            </div>

            <div className={styles.cardsGrid}>
                {activeStep.options.map((option, index) => {
                    const formatted = formatOptionLabel(option.label);
                    const isSelected = selectedValue === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={isSelected ? styles.optionCardActive : styles.optionCard}
                            onClick={() => handleSelectOption(activeStep.key, option.value)}
                            disabled={readOnly || catalogsLoading}
                        >
                            <span className={styles.optionSymbol}>{SYMBOLS[index % SYMBOLS.length]}</span>
                            <span className={styles.optionName}>{formatted.name}</span>
                            <span className={styles.optionCode}>{formatted.code}</span>
                        </button>
                    );
                })}
            </div>

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
