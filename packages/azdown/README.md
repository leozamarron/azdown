# azdown

Preview your Azure DevOps wiki in VS Code the way it looks in the browser.

If you keep your wiki in a Git repo, you already know the gap: you open a page
locally and the diagrams are raw text, the table of contents is literal
`[[_TOC_]]`, and half the images are broken. azdown closes that gap, so you can
read and write wiki pages without switching to the browser to check your work.

It extends VS Code's **built-in** Markdown preview rather than adding another
one, so <kbd>Ctrl</kbd>+<kbd>K</kbd> <kbd>V</kbd>, scroll sync and your theme
all keep working exactly as you expect. Everything runs locally against the
files already on your disk.

## Features

### Azure DevOps syntax

- **`::: mermaid` diagrams, rendered** — the three-colon form Azure DevOps
  uses, drawn in the preview and re-themed when you switch between light and
  dark. A ```` ```mermaid ```` code fence stays a code block, just like in the
  real wiki.
- **`::: video` and `::: math` containers.**
- **`[[_TOC_]]`** — table of contents, nested by heading level.
- **`[[_TOSP_]]`** — table of subpages, listing the real child pages.
- **Heading anchors** using Azure DevOps's slug algorithm.
- **Azure DevOps styling** — type scale, heading rules, bordered tables and the
  boxed table of contents, all drawn from your VS Code theme so light, dark and
  high-contrast each look right.
- **Links between pages work.** Azure DevOps writes them without a `.md`
  extension and resolves root-absolute ones against the wiki, so locally they
  normally lead nowhere. Links to headings work too, and a link that resolves
  to nothing is left exactly as you wrote it.

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
- Page-name completion and broken-link warnings while editing

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
