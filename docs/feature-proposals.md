# Feature proposals

Candidate stories for the next iteration. These are proposals, not committed scope. Preserve local browser processing and read-only source data.

| Priority | Feature | User story | Acceptance criteria | Size |
|---|---|---|---|---|
| 1 | Save and reopen plots | As a user, I want to save my plotting session so I can continue later without rebuilding it. | Download and reopen a versioned session with data, selected columns, colors, labels, scales and zoom. Invalid sessions preserve the current plot. | Medium |
| 2 | Date/time axes | As a user, I want to plot measurements against dates so I can inspect changes over time. | Accept ISO dates in X, sort chronologically, and show readable dates in charts, tooltips and exports. Agree on timezone handling first. | Large |
| 3 | Range filtering and statistics | As a user, I want to inspect an interval so I can compare series within that range. | Set inclusive X bounds; update both charts; show count, minimum, maximum and mean per series. Reset restores all rows without editing source data. | Medium |
| 4 | Line styles and marker shapes | As a user, I want to distinguish series in grayscale so printed charts remain readable. | Choose solid/dashed lines and marker shapes per series. Legends and exports match. | Small |
| 5 | Reference lines | As a user, I want to mark a target so I can see which measurements exceed it. | Add/remove labeled horizontal or vertical lines; include them in exports. Define log-scale and offscreen behavior. | Small |
| 6 | Import preview and diagnostics | As a user, I want to inspect a file before replacing my plot so I can catch formatting mistakes. | Preview headers and initial rows; identify invalid cells by row and column; replace data only after a valid import is confirmed. | Medium |

Save/reopen adds a complete workflow because refreshing currently clears data. Line styles are a smaller appearance task. Sizes are relative estimates. Turn selected stories into issues with agreed examples before implementation. Existing capabilities include CSV/XML import, multiple series, colors, labels, logarithmic scales, zoom/pan and image exports.
