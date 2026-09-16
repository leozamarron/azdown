# Change Log

All notable changes to the azdown extension are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
- Azure DevOps styling for the preview: type scale, ruled headings, bordered
  tables, boxed table of contents, and states for unrendered math, empty
  subpage lists and diagrams that failed to parse. Every colour comes from a
  --vscode-* variable, so light, dark and high-contrast themes all work.
- Links between wiki pages resolve: the missing `.md` extension, root-absolute
  paths relative to the wiki, `%2D` in page names, and heading fragments.
  Unresolvable links are left untouched rather than rewritten to a guess.
- Open previews re-render when the wiki root changes or a page is added or
  removed, instead of showing stale output until the document is edited.

### Known limitations

- KaTeX, `:shortcode:` emoji, `#123` / `!456` reference chips and relative wiki
  links are not implemented.
- The heading slug algorithm is not yet verified against a live wiki.
