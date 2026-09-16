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
- `[[_TOC_]]` table of contents, nested by heading level.
- `[[_TOSP_]]` table of subpages, listing real child pages when a wiki root is
  known.
- Heading anchors using an Azure DevOps-style slug algorithm.
- `/.attachments/` images resolved against the wiki root rather than the
  workspace folder.
- Wiki page tree in the activity bar, ordered by `.order` and showing Azure
  DevOps display titles.
- `azdown.wikiRoot` setting, autodetected from `.order` files.

### Known limitations

- Mermaid containers are parsed but the diagram is not rendered yet.
- KaTeX, `:shortcode:` emoji, `#123` / `!456` reference chips and relative wiki
  links are not implemented.
- Azure DevOps visual styling is not implemented.
- The heading slug algorithm is not yet verified against a live wiki.
