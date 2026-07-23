# Equivalencias Dragonfish

Stockia resuelve el código de exportación Dragonfish mediante una equivalencia única por artículo y color.

## Regla

- El artículo identifica también al proveedor.
- `colorCode="$"` representa `SIN COLOR`.
- Un código Dragonfish solo puede pertenecer a una equivalencia.
- La exportación consulta siempre la equivalencia vigente.
- Si falta alguna equivalencia con cantidades positivas, la exportación se bloquea.

## Formato TXT

Cada combinación de código y talle ocupa una línea:

```text
1+MTHJ70090!!38
2+MTHJ70090!!40
3+MTIDTP70095N!!L
```

## Importación masiva

La plantilla acepta CSV, XLS y XLSX con estas columnas:

```csv
supplier_code,article_sku,article_description,color_code,color_description,dragonfish_code
MITRE,70095,Descripción del artículo,N,Negro,MTIDTP70095N
MITRE,70090,Descripción del artículo,,SIN COLOR,MTHJ70090
```

Las descripciones son informativas. Un `color_code` vacío se normaliza como `SIN COLOR`.
La importación usa un flujo de previsualización y confirmación; una fila existente actualiza
la equivalencia vigente.
