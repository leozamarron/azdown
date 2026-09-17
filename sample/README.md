# Manual testing before release

These fixtures exercise the extension locally. No Azure DevOps account is
needed. Keep version `0.1.0` while validating its first publication.

## Run the development extension

1. Open the repository root in VS Code.
2. Run `npm install` if dependencies are not installed.
3. In **Run and Debug**, select **Run Extension (sample wiki)** and press **F5**.
   The launch task runs `npm run compile` for both packages automatically.
4. In the new **Extension Development Host** window, open the **Azure DevOps
   Wiki** panel. If an old `azdown.wikiRoot` setting overrides detection, use
   **Choose Wiki Folder** and select this repository's `sample/wiki` folder.
5. Open **Smoke Tests**, or open `Smoke-Tests.md` and press **Ctrl+K V**.

To build manually, run `npm run compile` from the repository root. After
changing extension code, stop and start the debug session to load the new
build. Editing the sample Markdown only needs the normal preview refresh.

## Reading checks

Follow the pages under **Smoke Tests** in order. Each states its expected
result. Only **Expected Errors** contains deliberately broken examples.

| Page | Check |
| --- | --- |
| Links And Attachments | Absolute and relative links, Unicode, `%2D`, encoded spaces, images and text attachments |
| Contents And Headings | One TOC, repeated headings, skipped levels and emoji anchors |
| Diagrams And Math | Multiple diagrams, theme changes, KaTeX, escaped emoji and ordinary Markdown |
| Empty Page | No misleading wiki-root warning on a page without children |
| Expected Errors | Missing targets and invalid expressions remain isolated from valid content |

## Editing checks

Use **Edit Page** in the tree to open the Markdown source.

- [ ] Use **Open Preview to the Side**; editing remains possible next to the preview.
- [ ] Open a nested page for editing; its matching tree entry is selected.
- [ ] On **Links And Attachments**, use **Copy Wiki Link**. Paste the result
  inside `[test](PASTE_HERE)` in another page. It should open the selected page.
- [ ] On **Smoke Tests**, choose **New Subpage** and enter `Temporary Check`.
  Expect `Smoke-Tests/Temporary-Check.md` and one new line in
  `Smoke-Tests/.order`, not a page at the wiki root.
- [ ] Keep `Smoke-Tests.md` preview open while creating that page. Its child
  list should update without editing `Smoke-Tests.md`.
- [ ] Open `Smoke-Tests/.order` and swap its first two lines. Save. Both the
  tree and the child list should reorder. Restore the two lines afterward.
- [ ] Try **New Subpage** with `Temporary Check` again. Expect an existing-page
  error; the original page's content must remain unchanged.
- [ ] Delete only the temporary page you created and remove its `.order`
  entry. The child list should update again.
- [ ] In **Diagrams And Math**, change a Mermaid label several times, then
  switch light/dark themes. The latest text and current theme should win.

## Root and preview checks

- [ ] Use **File: Close Folder** in the Extension Development Host, then
  use **Choose Wiki Folder** to select
  `sample/wiki`. The tree should populate even outside a workspace.
- [ ] With a wiki selected outside the workspace, repeat the `.order` check.
- [ ] Choose a wiki while a project is open, then open a different project in
  the same VS Code profile. The selected wiki should stay the same. Neither
  project's `.vscode/settings.json` or `.code-workspace` file should change.
- [ ] Change the selected wiki in another window using the same profile. The
  first window's tree and previews should update to the new selection.
- [ ] Open `sample/outside-wiki.md` using **File: Open File** in the development
  host. Its root-absolute test image must not borrow the selected wiki's image.
- [ ] Check light, dark and high-contrast themes. Tables, links, formulas and
  diagram errors should remain readable.

Selecting a root always saves a local user setting; clear
`azdown.wikiRoot` in that host's user settings when finished.

## Check the packaged extension

Once the development checks pass, run these from the repository root:

```bash
npm run compile
npm test
npm run package:vsix --workspace packages/azdown
```

Install `packages/azdown/azdown-0.1.0.vsix` using **Extensions: Install from
VSIX...** in a normal VS Code window and repeat the reading checks there.
This specifically checks that scripts, styles and KaTeX fonts travel with the
package. Packaging does not publish a release.

Compare uncertain heading anchors with a real Azure DevOps wiki separately;
these local fixtures check consistency within azdown, not exact remote parity.
