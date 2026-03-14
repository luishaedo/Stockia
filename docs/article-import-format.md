# Formato de archivo para importación masiva de artículos (preview/commit)

Esta guía explica cómo preparar archivos XLSX/CSV para `POST /admin/articles/import/preview` para que las filas sean importables y no disparen errores de validación.

## 1) Columnas obligatorias

La importación requiere estos campos canónicos:

- `sku`
- `description`
- `supplier_code`
- `family_code`
- `material_code`
- `category_code`
- `classification_code`
- `garment_type_code`
- `size_curve_code`

Si falta cualquier columna obligatoria en la fila de encabezados, el preview devuelve:

- `missingRequiredColumns` con cada nombre de columna faltante.
- `fileWarnings` con `Faltan columnas obligatorias`.

## 2) Aliases de encabezado aceptados por el parser

Los encabezados se normalizan antes de hacer el match:

- se recortan espacios al inicio/fin
- se convierten a minúsculas
- los espacios se reemplazan por `_`

Eso significa que `Supplier Code`, `supplier code` y `supplier_code` se tratan como la misma clave normalizada (`supplier_code`).

Aliases aceptados:

- `sku`: `sku`, `codigo_articulo`, `codigoarticulo`
- `description`: `description`, `descripcion`, `descripcion_sku`, `descriptionsku`
- `supplier_code`: `supplier_code`, `proveedor_code`, `proveedor`, `supplier`
- `family_code`: `family_code`, `family`, `familia_code`, `familia`
- `material_code`: `material_code`, `material`
- `category_code`: `category_code`, `category`, `categoria_code`, `categoria`
- `classification_code`: `classification_code`, `classification`, `clasificacion_code`, `clasificacion`
- `garment_type_code`: `garment_type_code`, `type_code`, `tipo_code`, `tipo_prenda_code`, `type`, `tipo_prenda`
- `size_curve_code`: `size_curve_code`, `size_table_code`, `curva_code`, `curve_code`, `size_curve`

### Columnas descriptivas opcionales

Son opcionales y se usan solo para warnings cuando el texto descriptivo no coincide con la descripción del catálogo para un código dado:

- `supplier_description`: `supplier_description`, `supplier_name`, `proveedor_descripcion`, `proveedor_nombre`
- `family_description`: `family_description`, `descripcion_familia`, `family_desc`
- `material_description`: `material_description`, `material_desc`
- `category_description`: `category_description`, `descripcion_categoria`, `category_desc`
- `classification_description`: `classification_description`, `descripcion_clasificacion`, `classification_desc`
- `garment_type_description`: `garment_type_description`, `type_description`, `descripcion_tipo`, `tipo_prenda_descripcion`
- `size_curve_description`: `size_curve_description`, `curve_description`, `descripcion_curva`

## 3) Orden de columnas

El orden de columnas no es fijo ni obligatorio.

El importador resuelve columnas por nombre de encabezado normalizado/alias, no por posición. Podés ubicar los campos requeridos en cualquier orden, siempre que los encabezados sean válidos.

## 4) Requisitos de datos por fila

Cada fila es importable únicamente si pasa todos estos controles:

1. Cada campo de código obligatorio está completo:
   - `supplier_code`, `family_code`, `material_code`, `category_code`, `classification_code`, `garment_type_code`, `size_curve_code` no vacíos.
2. Cada código existe en su tabla catálogo (supplier/family/material/category/classification/garmentType/sizeCurve).
3. El par `supplier_code + sku` es único dentro del archivo subido.
4. El par `supplier_code + sku` no existe previamente en base de datos.
5. La validación del payload de artículo pasa:
   - `sku` y `description` deben ser strings no vacíos.
   - todos los IDs de catálogo resueltos deben ser no vacíos.

## 5) Significado de errores comunes en preview

- `Falta código de supplier | Falta código de family | ...`
  - La celda de ese código está vacía en esa fila.
- `supplier_code + sku duplicado dentro del archivo`
  - Otra fila del mismo archivo tiene exactamente la misma combinación `supplier_code` + `sku`.
- `El payload no cumple las reglas de validación para crear artículos`
  - Al menos un campo obligatorio del payload quedó vacío luego de normalizar/resolver (normalmente `sku`/`description` vacíos, código faltante o código no resuelto en catálogo).

## 6) Plantilla práctica

Usá esta fila de encabezado (nomenclatura canónica recomendada):

```csv
sku,description,supplier_code,family_code,material_code,category_code,classification_code,garment_type_code,size_curve_code,supplier_description,family_description,material_description,category_description,classification_description,garment_type_description,size_curve_description
```

Ejemplo mínimo de fila válida (las columnas descriptivas opcionales se pueden omitir):

```csv
SKU-001,Basic cotton t-shirt,SUP-01,FAM-10,MAT-05,CAT-02,CLASS-01,GT-TSHIRT,SC-ADULT
```

## 7) Secuencia recomendada de importación

1. Asegurá que estén cargados primero los catálogos maestros (supplier, family, material, category, classification, garmentType, sizeCurve).
2. Generá el archivo con encabezados canónicos.
3. Subí el archivo al endpoint de preview.
4. Corregí filas con `errors` hasta que la fila tenga `importable=true`.
5. Ejecutá el commit del preview.
