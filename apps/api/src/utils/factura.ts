import { DuplicateHandler, FacturaItem, VarianteColor } from '@stockia/shared';

export const getItemKey = (item: Pick<FacturaItem, 'marca' | 'tipoPrenda' | 'codigoArticulo'>) =>
    `${item.marca}|${item.tipoPrenda}|${item.codigoArticulo}`;

export const mergeItems = (items: FacturaItem[], handler: DuplicateHandler = 'ERROR'): FacturaItem[] => {
    const itemMap = new Map<string, FacturaItem>();

    for (const item of items) {
        const itemKey = getItemKey(item);

        if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, {
                ...item,
                colores: item.colores.map(c => ({
                    ...c,
                    cantidadesPorTalle: { ...c.cantidadesPorTalle } as Record<string, number>
                }))
            });
            continue;
        }

        const existingItem = itemMap.get(itemKey)!;
        const colorMap = new Map<string, VarianteColor>();

        for (const color of existingItem.colores) {
            colorMap.set(color.codigoColor, color);
        }

        for (const newColor of item.colores) {
            if (colorMap.has(newColor.codigoColor)) {
                if (handler === 'ERROR') {
                    throw new Error('DUPLICATE_ITEM_COLOR_IN_PAYLOAD');
                }

                const existingColor = colorMap.get(newColor.codigoColor)!;
                const newQuantities = newColor.cantidadesPorTalle as Record<string, number>;
                const existingQuantities = existingColor.cantidadesPorTalle as Record<string, number>;

                if (handler === 'REPLACE') {
                    existingColor.cantidadesPorTalle = { ...newQuantities };
                } else if (handler === 'SUM') {
                    for (const [talle, cant] of Object.entries(newQuantities)) {
                        existingQuantities[talle] = (existingQuantities[talle] || 0) + cant;
                    }
                }
            } else {
                const clonedColor = {
                    ...newColor,
                    cantidadesPorTalle: { ...newColor.cantidadesPorTalle } as Record<string, number>
                };
                colorMap.set(newColor.codigoColor, clonedColor);
                existingItem.colores.push(clonedColor);
            }
        }
    }

    return Array.from(itemMap.values());
};

export const validateFacturaIntegrity = (factura: any): string | null => {
    if (!factura.items || factura.items.length === 0) {
        return 'Invoice must have at least one item';
    }

    let hasAnyPositiveQuantity = false;

    for (const item of factura.items) {
        if (!item.colores || item.colores.length === 0) {
            return `Item ${item.codigoArticulo} must have at least one color`;
        }

        for (const color of item.colores) {
            const quantities = color.cantidadesPorTalle as Record<string, number>;
            const hasPositive = Object.values(quantities).some(q => q > 0);
            hasAnyPositiveQuantity = hasAnyPositiveQuantity || hasPositive;

            const sizes = Object.keys(quantities);
            for (const size of sizes) {
                if (!item.curvaTalles.includes(size)) {
                    return `Size ${size} not in curve for item ${item.codigoArticulo}`;
                }
            }
        }
    }

    if (!hasAnyPositiveQuantity) {
        return 'Invoice must have at least one quantity > 0';
    }

    return null;
};
