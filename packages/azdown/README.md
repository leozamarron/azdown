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
- **KaTeX maths** — `$…$` inline and `$$…$$` block, rendered without asking
  your preview to load anything extra. Prices like `$5 and $10` are left alone.
- **`[[_TOC_]]`** — table of contents, nested by heading level.
- **`[[_TOSP_]]`** — table of subpages, listing the real child pages.
- **`:shortcode:` emoji** — the GitHub set Azure DevOps uses, without GitHub's
  custom ones, and `\\:smile:` escapes the conversion.
- **Heading anchors** following the slug algorithm Microsoft documents,
  including its one published worked example.
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
- **The tree is for writing, not just reading.** The page you are editing stays
  highlighted, and each page offers edit, preview to the side, copy wiki link,
  and new subpage — which creates the file and registers it in `.order` for you.

The wiki root is detected automatically from `.order` files. Override it with
`azdown.wikiRoot` or the folder picker in the panel.

## Not yet implemented

Being honest about scope:

- Page-name completion and broken-link warnings while editing
- `[[_TOSP_]]` outside a wiki: subpages need a wiki root, so the table stays
  empty when azdown cannot find one

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `azdown.wikiRoot` | `""` | Folder to treat as the wiki root. Absolute, or relative to the first workspace folder. Empty means autodetect via `.order`. |

## Commands

| Command | Description |
| --- | --- |
| `azdown: Choose Wiki Folder` | Pick the wiki root manually |
| `azdown: Refresh Wiki Tree` | Re-detect and reload the page tree |
| `azdown: New Page` | Create a page at the wiki root and update `.order` |

Each page's context menu also offers **Edit Page**, **Open Preview to the
Side**, **Copy Wiki Link**, and **New Subpage**. Changes to `.order` refresh
open previews as well as the tree, including for a selected wiki outside the
workspace.

## Known limitations

Heading anchors match the algorithm Microsoft documents, and its one published
example. The documentation stops short of specifying what happens to non-Latin
scripts, emoji, or punctuation left stranded at the end of a heading, so those
may still differ from a live wiki. If you hit a mismatch,
[open an issue](https://github.com/leozamarron/azdown/issues) with the heading
and the anchor Azure DevOps generated — that is the fastest way to close one.

`::: math` is supported but is not documented Azure DevOps syntax; Microsoft
documents `$…$` and `$$…$$`, which are what you should prefer.

## License

MIT
