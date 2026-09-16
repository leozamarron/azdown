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
| Heading anchors | Implemented; slug algorithm **unverified** against a live wiki |
| KaTeX | TODO |
| `:shortcode:` emoji | Implemented |
| Relative wiki links (`%2D` escaping) | Implemented |
| `#123` / `!456` ref chips | Not implemented — see the extension README |
| Azure DevOps styling | Implemented — theme-aware, light and dark |

## Development

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run compile      # both packages
npm test             # plugin unit tests -- no VS Code, no display needed
npm run lint
```

Press <kbd>F5</kbd> to launch the Extension Development Host, then:

- open `sample/azdown-showcase.md` and preview it to eyeball syntax fidelity;
- open the **Azure DevOps Wiki** panel in the activity bar, point it at
  `sample/wiki/`, and check the tree, `[[_TOSP_]]` and the attachment image.

The VS Code integration suite is separate because it downloads VS Code and
needs a display:

```bash
npm run test:vscode              # or: xvfb-run -a npm run test:vscode
```

## License

MIT
