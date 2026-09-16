# Change Log

All notable changes to the azdown extension are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-16

### Added

- Extends VS Code's built-in Markdown preview via `markdown.markdownItPlugins`,
  keeping Ctrl+K V, scroll sync and theme integration.
- `::: mermaid`, `::: video` and `::: math` three-colon containers. Backtick
  code fences are left as code blocks, matching Azure DevOps.
- Mermaid diagrams are rendered in the preview, following the editor theme and
  re-drawing when it changes. A malformed diagram reports its error in place
  without affecting the others on the page.
- `[[_TOC_]]` table of contents, nested by heading level.
- `[[_TOSP_]]` table of subpages, listing real child pages when a wiki root is
  known.
- Heading anchors using an Azure DevOps-style slug algorithm.
- `/.attachments/` images resolved against the wiki root rather than the
  workspace folder.
- Wiki page tree in the activity bar, ordered by `.order` and showing Azure
  DevOps display titles.
- `azdown.wikiRoot` setting, autodetected from `.order` files.
- Authoring actions on the wiki tree: edit a page, open its preview to the
  side, copy its Azure DevOps wiki link, and create pages and subpages. A new
  page is registered in its folder's `.order`, creating the folder and the file
  when needed. The page being edited is highlighted in the tree.
- `:shortcode:` emoji, using the GitHub set minus GitHub's custom emoji, which
  Azure DevOps documents as unsupported. A leading backslash escapes the
  conversion, as documented.
- KaTeX maths: `$…$` inline, `$$…$$` block, and the body of `::: math`.
  Rendered at parse time, so the preview gains a stylesheet and fonts but no
  extra script. A malformed expression reports KaTeX's own error in place.
- Azure DevOps styling for the preview: type scale, ruled headings, bordered
  tables, boxed table of contents, and states for unrendered math, empty
  subpage lists and diagrams that failed to parse. Every colour comes from a
  --vscode-* variable, so light, dark and high-contrast themes all work.
- Links between wiki pages resolve: the missing `.md` extension, root-absolute
  paths relative to the wiki, `%2D` in page names, and heading fragments.
  Unresolvable links are left untouched rather than rewritten to a guess.
- Open previews re-render when the wiki root changes or a page is added or
  removed, instead of showing stale output until the document is edited.

### Fixed

- Heading anchors no longer collapse consecutive hyphens. Microsoft's
  documented example (`Team #1 : Release Wiki!` → `#team-1--release-wiki`)
  keeps the double hyphen, so collapsing it broke anchors for any heading with
  punctuation between two spaces.

### Deliberately not implemented

- `#123` work item and `!456` pull request chips. Microsoft documents `#` as an
  editor affordance that inserts an ordinary link, not a rendering rule, and
  `!456` does not appear in the documentation at all. A blanket rule would turn
  colour hex codes and numbers in prose into chips.

### Known limitations

- KaTeX, `:shortcode:` emoji, `#123` / `!456` reference chips and relative wiki
  links are not implemented.
- Heading anchors follow Microsoft's documented algorithm and its published
  example. Cases the documentation does not specify — non-Latin scripts, emoji,
  trailing punctuation — remain unverified.
- `::: math` is not documented Azure DevOps syntax; `$…$` and `$$…$$` are, and
  both now work.
