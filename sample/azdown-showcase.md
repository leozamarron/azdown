# azdown — hoja de pruebas

Abre este archivo con `Ctrl+K V` y compáralo contra la misma página en un wiki
real de Azure DevOps. Cada sección dice si ya está implementada o pendiente.

[[_TOC_]]

---

## 1. Containers de tres dos puntos — IMPLEMENTADO

### Mermaid

::: mermaid
graph LR
  A[Commit] --> B{CI}
  B -->|pasa| C[Merge]
  B -->|falla| D[Rechazo]
:::

El diagrama **debe dibujarse**. Cambia el tema de VS Code (claro/oscuro) y
debe volver a dibujarse solo, con los colores del tema nuevo.

Segundo diagrama, para comprobar que se renderizan varios:

::: mermaid
sequenceDiagram
  Dev->>CI: push
  CI->>Marketplace: publish
  Marketplace-->>Dev: v0.1.0
:::

### Diagrama inválido

Debe mostrar el error de Mermaid **en su caja**, y los diagramas de arriba
deben seguir dibujados. Si un diagrama roto tumba a los demás, hay un bug:

::: mermaid
graph LR
  A --> --> B[[[
:::

### Un code fence NO es un container

Esto tiene que seguir siendo un bloque de código, no un diagrama:

```mermaid
graph LR
  A --> B
```

### Video

::: video
<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe>
:::

### Math (container)

::: math
\frac{n!}{k!(n-k)!} = \binom{n}{k}
:::

Pendiente KaTeX: por ahora se ve la fuente dentro de una caja.

### Kind desconocido

Esto debe quedar como texto plano, no desaparecer:

::: loquesea
contenido que no se debe tragar
:::

---

## 2. Macros — IMPLEMENTADO

El `[[_TOC_]]` de arriba debe listar todos estos encabezados y sus enlaces
deben funcionar al hacer clic.

### Subpáginas

[[_TOSP_]]

Renderiza un placeholder vacío a propósito: listar subpáginas exige el árbol
del wiki, que un `.md` suelto no tiene.

### El macro debe estar solo en su línea

Texto [[_TOC_]] más texto — esto **no** debe generar un índice.

---

## 3. Anclas de encabezado — PARCIAL

Cada encabezado lleva un `id`. El algoritmo de slug es **best-effort y no está
verificado** contra Azure DevOps real.

### Overview

### Overview

Dos encabezados iguales: el segundo debe recibir `overview-1`.

### Título con C# y símbolos raros !@#

### Configuración en español

### 1. Empieza con dígito

Estos cuatro son justo los casos dudosos. Compáralos contra un wiki real.

#### Team #1 : Release Wiki!

Este es el **único ejemplo resuelto que publica Microsoft**. El ancla tiene que
ser exactamente `#team-1--release-wiki`, con el guion doble. Comprueba que este
enlace salta aquí: [Visit the Project Wiki](#team-1--release-wiki).

---

## 4. KaTeX — IMPLEMENTADO

Inline pegado: $E = mc^2$ — y con espacios, como en el ejemplo de la
documentación de Azure DevOps: $ A + B = C $

Bloque:

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

Los precios **no** deben convertirse: cuesta $5 y $10.

Fórmula inválida, debe mostrar el error de KaTeX en su sitio: $\frac{roto$

---

## 5. Emoji por shortcode — IMPLEMENTADO

:smile: :rocket: :warning: :heavy_check_mark: :+1::+1:

Los custom de GitHub **no** los soporta Azure DevOps, así que deben quedar
literales: :bowtie: :octocat:

Escape con barra invertida — deben verse los dos puntos, no el emoji:
\:smile: \:angry: \:cry:

---

## 6. Enlaces relativos de wiki — IMPLEMENTADO

Ojo: este archivo **no** está dentro de un wiki, así que ninguno resuelve y
todos deben quedar tal cual se escribieron. Para verlos funcionar, abre
`sample/wiki/Onboarding.md`, que sí tiene raíz.

- [Página hermana](./Otra-Pagina)
- [Con guion escapado](./Build%2DAnd%2DRelease)
- [Subpágina](/Equipo/Onboarding)

El escapado `%2D` importa: en Azure DevOps `A-B` y `A%2DB` son páginas
distintas.

---

## 7. Referencias a work items — NO IMPLEMENTADO A PROPÓSITO

Work item #123, pull request !456, color hex #123456, error #404.

Los cuatro deben quedar como **texto plano**. En Azure DevOps el `#` es una
ayuda del editor (autosuggest) que inserta un enlace normal en el archivo; no
hay nada que documente que un `#123` guardado se convierta en chip. Y `!456` no
aparece en la documentación.

Convertirlos automáticamente rompería los dos últimos casos de esta línea.

---

## 8. GFM base — debe seguir funcionando

| Feature | Estado |
| --- | --- |
| Tablas | ✅ |
| Tachado | ~~así~~ |
| Checklists | ver abajo |

- [x] Tarea hecha
- [ ] Tarea pendiente

> Cita en bloque
> con dos líneas.

`código inline` y un enlace [normal](https://example.test).

---

## 9. Casos borde

### Container indentado cuatro espacios

    ::: mermaid
    esto es un bloque de código

### Overview

Tercer "Overview" del documento: debe recibir `overview-2`.

### Container sin cerrar

Va al final a propósito: un container sin cerrar se come todo lo que sigue,
igual que un code fence sin cerrar.

::: mermaid
graph LR
  A --> B
