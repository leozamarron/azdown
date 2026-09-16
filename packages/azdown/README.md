# azdown

Renders Markdown in VS Code exactly like Azure DevOps Wiki does — syntax and styling.

Extends VS Code's **built-in** Markdown preview, so <kbd>Ctrl</kbd>+<kbd>K</kbd>
<kbd>V</kbd>, scroll sync and theme integration keep working. There is no
separate preview window to learn.

**No credentials.** azdown never asks for a Personal Access Token and never
contacts your organization. Work item and pull request references are styled
locally, not resolved.

## Features

### Azure DevOps syntax

- **`::: mermaid`, `::: video`, `::: math` containers** — the three-colon form
  Azure DevOps uses. A ```` ```mermaid ```` code fence stays a code block, just
  like in the real wiki.
- **`[[_TOC_]]`** — table of contents, nested by heading level.
- **`[[_TOSP_]]`** — table of subpages, listing the real child pages.
- **Heading anchors** using Azure DevOps's slug algorithm.

### Wiki-aware

Point azdown at your wiki folder and it understands the things a lone Markdown
file cannot express:

- **`/.attachments/` images resolve.** Azure DevOps links attachments
  root-absolutely, which a plain preview resolves against the wrong folder —
  the usual cause of broken images when you open a wiki locally.
- **A page tree in the activity bar**, with pages named the way the wiki names
  them: `Build-And-Release.md` shows as "Build And Release", and `%2D` stays a
  literal dash.
- **`.order` is respected**, so the tree matches your wiki's real page order.

The wiki root is detected automatically from `.order` files. Override it with
`azdown.wikiRoot` or the folder picker in the panel.

## Not yet implemented

Being honest about scope:

- KaTeX rendering (`$…$`, `$$…$$`, and the body of `::: math`)
- `:shortcode:` emoji
- `#123` / `!456` reference chips
- Relative links between wiki pages
- Azure DevOps visual styling

Mermaid containers are parsed and emitted, but the diagram is not drawn yet.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `azdown.wikiRoot` | `""` | Folder to treat as the wiki root. Absolute, or relative to the first workspace folder. Empty means autodetect via `.order`. |

## Commands

| Command | Description |
| --- | --- |
| `azdown: Choose Wiki Folder` | Pick the wiki root manually |
| `azdown: Refresh Wiki Tree` | Re-detect and reload the page tree |

## Known limitations

The heading slug algorithm is best-effort. Azure DevOps does not document how
it derives anchors, so headings containing punctuation, non-Latin scripts,
leading digits or emoji may not match a live wiki exactly. If you hit a
mismatch, [open an issue](https://github.com/leozamarron/azdown/issues) with the
heading and the anchor Azure DevOps generated — that is the fastest way to get
it fixed.

## License

MIT
