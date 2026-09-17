# Expected Errors

[Back to the test index](/Smoke-Tests)

**The failures on this page are intentional.** They check that invalid content
does not prevent the rest of the page from working.

## Missing link

[Intentionally missing page — expected failure](/Does-Not-Exist)

Expected: the link stays as written. Clicking it cannot open an existing page.
This is not a release failure. Broken-link diagnostics are not implemented yet.

## Missing image

![Intentionally missing image — expected failure](/.attachments/does-not-exist.png)

Expected: an unavailable image or its alternative text, not an unrelated image.

## Invalid Mermaid

::: mermaid
graph LR
  A --> --> B[[[
:::

Expected: an error in this diagram's box. The valid diagram immediately after
it must still render.

::: mermaid
graph LR
  A[Still] --> B[Working]
:::

## Invalid math followed by valid math

::: math
\frac{broken
:::

Expected: an error with the original expression. This valid formula must still
render afterward: $x^2 + y^2 = z^2$.

## Unclosed container inside a list

- ::: mermaid
  graph LR
    A --> B

## Content after the list

This heading and paragraph must remain visible outside the diagram.

[Return to the test index](/Smoke-Tests)
