# Smoke Tests

Start here to check the extension before publishing `0.1.0`.
Open the preview with **Ctrl+K V** and select this folder as the wiki root.

## Test pages

[[_TOSP_]]

Expected: the child list above matches the expanded **Smoke Tests** entry in
the sidebar, in the order stored in `Smoke-Tests/.order`.

1. [Links and attachments](./Smoke-Tests/Links-And-Attachments)
2. [Contents and headings](./Smoke-Tests/Contents-And-Headings)
3. [Diagrams and math](./Smoke-Tests/Diagrams-And-Math)
4. [A page without children](./Smoke-Tests/Empty-Page)
5. [Expected errors](./Smoke-Tests/Expected-Errors)

All links on this page should work. Deliberately invalid examples are clearly
labelled on **Expected Errors**.

## Live updates

Leave this preview open. In the sidebar, right-click **Smoke Tests** and create
a subpage named `Temporary Check`. It should appear in both this list and the
tree. Changing `Smoke-Tests/.order` should reorder both immediately after saving.

## Existing examples

- [Onboarding](/Onboarding)
- [Build and release](/Build-And-Release)
- [A title with a literal hyphen](/Azure%2DDevOps-Notes)
