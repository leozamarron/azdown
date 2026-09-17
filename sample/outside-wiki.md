# Outside the selected wiki

Open this file while `sample/wiki` is selected as the wiki root.
This document lives outside that root.

![Expected missing image outside the wiki](/.attachments/diagram.png)

Expected: the root-absolute image must not be rewritten to the blue square
inside `sample/wiki/.attachments`. VS Code's normal path resolution applies.
In a repository-root workspace, that image does not exist.

[[_TOSP_]]

Expected: no pages from the selected wiki appear here.

Ordinary Markdown should still render: **bold**, *italic* and `inline code`.
