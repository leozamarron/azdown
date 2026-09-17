# Links And Attachments

[Back to the test index](/Smoke-Tests)

Every link and image on this page has a real local target. A failure here is
unexpected. The child list also exercises links from a nested page.

[[_TOSP_]]

## Page links

| Link | Expected destination |
| --- | --- |
| [Wiki-root absolute](/Build-And-Release) | Build And Release |
| [Relative sibling](./Contents-And-Headings) | Contents And Headings |
| [Climb one directory](../Onboarding) | Onboarding |
| [Explicit .md](./Diagrams-And-Math.md) | Diagrams And Math |
| [Literal hyphens](./Name%2DWith%2DHyphens) | Name-With-Hyphens |
| [Encoded filesystem URL](./Name%252DWith%252DHyphens.md) | The same Name-With-Hyphens page |
| [Spaces in the title](./Name-With-Spaces) | Name With Spaces, a different page |
| [Unicode filename](./Página-con-acentos) | Página con acentos |
| [Cross-page heading](./Contents-And-Headings#anchor-destination) | Anchor destination heading |
| [Same-page heading](#images) | Images heading below |
| [Nested child](./Links-And-Attachments/Deep-Page) | Deep Page |

## Images

The PNG should show a blue square:

![Existing blue test square](/.attachments/diagram.png)

This attachment contains a space in its filename. The SVG should show a blue
card labelled **azdown attachment OK**:

![Attachment with an encoded space](/.attachments/diagram%20sample.svg)

The same file, with a relative path and angle brackets around the URL:

![Same attachment via a relative path](<../.attachments/diagram sample.svg>)

## Non-image attachment

[Open the text attachment](/.attachments/Manual-Test-Notes.txt)

Expected: the local text file is opened or offered by VS Code. It contains
`azdown attachment test: OK`.
