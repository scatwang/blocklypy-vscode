# Plot messages

Plot notifications use MessageType PlotNotification (0x73) with subcodes:

- Define (0x01): column names (zstrings)
- UpdateCells (0x02): pairs of (name, value)
- UpdateRow (0x03): array of float values (in known column order)

Host may optionally reply with Plot Acknowledge (0x72).

Hub must define the columns (dimensions) with names.

- either by sending a Define command
- or ad-hoc by sending UpdateCells command

Later for any defined dinemsion the num can update the value by sending

- UpdateRow respecting the defined order or columns
- UpdateCells using any already or newly defined columns
