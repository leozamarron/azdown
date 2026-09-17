# Contents And Headings

[Back to the test index](/Smoke-Tests)

[[_TOC_]]

Expected: one **Contents** box. Click every entry, especially the similarly
named entries below. Each should reach its own heading.

## Anchor destination

The cross-page link from **Links And Attachments** should land here.

## Overview

First occurrence. [Jump to the second occurrence](#overview-1).

## Overview

Second occurrence. It must have a different anchor from the first.

## Overview-1

This title resembles an automatically generated suffix. Its TOC entry must
land here, not at the preceding heading.

## Overview

Third occurrence. Its TOC entry must reach this paragraph.

##### Skipped heading levels

Jumping from level two to level five should not break the list or swallow
the next entry.

### Back to level three

This must remain inside a valid, readable table of contents.

## Emoji :rocket:

Expected: a rocket in both the heading and its TOC label, and a working link.

## Escaped \:smile:

Expected: the literal shortcode in the heading and TOC, with a working link.

## Configuración en español

Accented text should display correctly. The TOC link should work locally;
exact Azure DevOps anchor compatibility is still a separate comparison.

#### Team #1 : Release Wiki!

[This link](#team-1--release-wiki) should reach this heading.

## Duplicate macro

The second macro below must not produce a second Contents box. Edit a heading,
save, and refresh the preview: the first box should remain visible and current.

[[_TOC_]]
