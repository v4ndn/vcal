# vcalendar

A CalDAV calendar app with tasks and journaling, built with React and packaged as a native desktop app via Tauri.

## Features

### Calendar
- Week grid with week navigation and a "Today" shortcut
- Mini calendar in the sidebar for quick week jumping
- Drag events to reschedule them; drag their bottom edge to resize — both snap to 15-minute intervals
- Click-drag on empty space to draw a new event
- All-day event row at the top of the grid
- Shift-click to select multiple events; copy/paste the selection
- Right-click context menu on any event
- Click an event to open a read-only overview, double-click (or use the context menu) to edit
- Recurring event support — edit scope: this occurrence only, or all events in the series
- Event presets: select two or more events, save them as a named preset, then drag the preset from the sidebar onto the calendar to recreate the whole group at once

### Events & Tasks (shared form)
- Title, Markdown description, start/end date-time or all-day toggle
- Assign to any synced calendar
- Repeat: daily, weekly, monthly, yearly, weekdays, or custom RRULE string
- Multiple reminders per event (desktop notifications via Tauri)

### Tasks
- Dedicated tasks page with tasks grouped by: Overdue, Today, Tomorrow, This week, Later, No due date
- Completed tasks in a collapsible section at the bottom
- Inline Markdown description rendering
- Recurring tasks shown with a repeat indicator
- One-click checkbox to mark complete
- Shift-click to multi-select; bulk delete via right-click context menu
- Search bar to filter by title
- Day panel on the right: click any day in the sidebar mini calendar to see that day's tasks

### Journal
- Dedicated journal page with a two-panel layout: tree on the left, editor on the right
- Notes are organized into collections (CalDAV calendars marked as journals)
- Folder hierarchy using `/` in the note title — e.g. `February/24th` creates a `February` folder
- Per-note icon picker (any Lucide icon)
- Shift-click to multi-select notes and folders
- Drag and drop to move notes or entire folders between folders and collections
- Right-click context menu: edit metadata, delete note, delete folder (with nested note count)
- Rich Markdown editor (Milkdown) with inline editing and a manual save button

### Theming
- Built-in light, dark, and sepia themes
- Fully custom theme editor — adjust all nine color tokens independently
- Adjustable hour row height in the week grid
- All preferences persisted locally

### General
- Connects to any CalDAV server (Nextcloud, iCloud, Fastmail, etc.)
- Toggle individual calendars on/off from the sidebar
- Manual refresh and disconnect buttons
- Mobile-responsive: single-day view with day navigation, bottom tab bar

## Planned

- Month and day views
- Attendees / invite flow
- Timezone handling per event
- Per-event colors
- Multiple CalDAV accounts simultaneously
- Keyboard shortcuts
- Mobile app (iOS & Android)
- More customization options in preferences
- Plugin support

## Build

**Prerequisites:** Node.js, Rust (for the desktop build only)

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the web dev server |
| `npm run build` | Build the web app |
| `npm run tauri:dev` | Launch the desktop app in dev mode |
| `npm run tauri:build` | Build a distributable desktop binary |
