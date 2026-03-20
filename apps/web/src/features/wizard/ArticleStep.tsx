import { ArticleResponse } from '../../services/articlesApi';
import { MasterArticleResolver, ArticleDraftForm, SupplierOption } from './MasterArticleResolver';

type Option = { value: string; label: string; id?: string; code?: string };

interface ArticleStepProps {
    supplier?: SupplierOption | null;
    supplierLocked?: boolean;
    selectedArticle: ArticleResponse | null;
    articleDraft: ArticleDraftForm;
    familyOptions: Option[];
    categoryOptions: Option[];
    garmentTypeOptions: Option[];
    classificationOptions: Option[];
    materialOptions: Option[];
    sizeCurveOptions: Option[];
    catalogsLoading: boolean;
    catalogsError: string | null;
    onDraftChange: (field: keyof ArticleDraftForm, value: string) => void;
    onArticleSelected: (article: ArticleResponse) => void;
    onNext: () => void;
    onSupplierCreated: (supplier: SupplierOption) => void;
    readOnly?: boolean;
}

export type { ArticleDraftForm, SupplierOption };

export function ArticleStep(props: ArticleStepProps) {
    return (
        <MasterArticleResolver
            title="Paso 1 · Resolver artículo maestro"
            subtitle="Buscá uno existente o crealo/clonalo sin salir del wizard. El ítem se guarda vinculado al catálogo maestro."
            confirmLabel="Continuar con colores"
            allowSupplierCreation
            onConfirm={props.onNext}
            {...props}
        />
    );
}
