# azdown

Preview your Azure DevOps wiki in VS Code the way it looks in the browser.

Extends VS Code's **built-in** Markdown preview via the
`markdown.markdownItPlugins` contribution point, so `Ctrl+K V`, scroll sync and
theme integration keep working. Everything runs locally against the files
already on your disk.

## Layout

| Package | What it is |
| --- | --- |
| `packages/markdown-it-azdown` | The parser plugin. Framework-agnostic, publishable to npm, so a CLI or a browser extension can reuse the syntax. |
| `packages/azdown` | The VS Code extension. Thin: wires the plugin into the preview and ships the CSS. |

## Feature status

| Feature | Status |
| --- | --- |
| `::: mermaid` / `::: video` / `::: math` containers | Implemented, Mermaid diagrams rendered |
| `[[_TOC_]]` | Implemented |
| `[[_TOSP_]]` | Implemented — lists real subpages once a wiki root is known |
| `/.attachments/` images | Implemented — resolved against the wiki root |
| Wiki tree panel | Implemented — activity bar view, `.order` aware, with authoring actions |
| Heading anchors | Implemented — matches Microsoft's documented algorithm and its published example |
| `:shortcode:` emoji | Implemented |
| KaTeX | Implemented — inline and block |
| Relative wiki links (`%2D` escaping) | Implemented |
| `#123` / `!456` ref chips | Not implemented — see the extension README |
| Azure DevOps styling | Implemented — theme-aware, light and dark |

## Development

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run compile      # both packages
npm test             # parser, host and preview unit tests; no display needed
npm run lint
```

For a guided check, select **Run Extension (sample wiki)** in Run and Debug,
then press <kbd>F5</kbd>. It compiles both packages and opens the sample wiki
in an Extension Development Host. Start with `Smoke-Tests.md` and follow the
[manual testing guide](sample/README.md).

The original **Run Extension** configuration opens the entire repository:

- open `sample/azdown-showcase.md` and preview it to eyeball syntax fidelity;
- open the **Azure DevOps Wiki** panel in the activity bar, point it at
  `sample/wiki/`, and check the tree, `[[_TOSP_]]` and the attachment image.

The VS Code integration suite is separate because it boots a real VS Code and
therefore needs a display:

```bash
npm run test:vscode                    # on a desktop
xvfb-run -a npm run test:vscode        # on a headless machine
```

On Arch, `xvfb` comes from `xorg-server-xvfb`. Without a display the run hangs
rather than failing, so it is not wired into `npm test`.

## License

MIT
