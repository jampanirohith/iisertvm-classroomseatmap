# IISER TVM - Lecture Hall Complex seat map

Open a classroom to see its seating arrangement. Add an event (a class, exam or anything else) and mark your seat for exams (classes do not use seat marking).

## Pages

- `index.html` - the classrooms
- `interactive-map.html` - the Lecture Hall Complex floor plan; select a classroom
- `room.html?room=lhc-kaumudi` - seating arrangement, events and exam seat marking for one classroom

## Responsive layout

The interface includes a saved light/dark theme, a high-contrast futuristic seat map, and responsive event cards. Existing seat numbering and arrangement are preserved. On phones, the seat map retains a readable tap size and can be panned in both directions. The room title remains stable as you switch between events.

## Run locally

```
python3 -m http.server 8000
```

Open http://localhost:8000. Events, exam seat marks, and theme preference are saved in the browser. Recurring classes are expanded into separate dated event sessions, so each session is a separate event, with seat marking enabled only for exam events. When shared Supabase storage is configured, recurring sessions are inserted together using the existing schema; no recurrence-specific SQL migration is required. Recurrence can run for up to 180 days; choose the starting date first, then repeat every week or select individual weekdays. The repeat-until date is inclusive. Each generated session can be selected and managed separately. Event times that overlap an existing event in the same room are rejected.

## Shared exam seat marks (optional)

1. Create a Supabase project and run `supabase/schema.sql`, then `supabase/seed.sql`, in the SQL editor.
2. Put the project URL and the publishable (anon) key in `supabase/config.js`. Never put a service_role key in browser code.

Seat marks made with an earlier version used seat ids such as `B-28`. They no longer match any seat; remove them with `delete from seat_marks;` if you want a clean start.

The classroom was renamed from Kaumadi to Kaumudi (id `lhc-kaumudi`). Remove the old row with `delete from rooms where id = 'lhc-kaumadi';`.

## Editing a classroom

Seating arrangements are in `js/data.js`. A room with `layout: null` shows a notice instead of a map.

```
layout: {
  rows: [ { seats: ['1', '2', ...], lead: 0, aislesAfter: [4, 12], tail: { kind: 'stairs', cols: 4 } } ],   // seats left to right; tail is optional
  sideStairs: { side: 'left', fromRow: 0, toRow: 10 },                    // optional stair strip
  aisleLabel: 'STAIRS',                                                   // optional label for aisles
  board: { from: 1, to: 2 },                                              // optional: board spans these blocks (default: the middle one)
  looseChairs: { segments: 4 },                                           // optional: unnumbered chairs in front of row 1, one per seat in the first N blocks
  exits: {
    front: ['left', 'right'],                                             // doors beside the board
    sides: [{ row: 1, side: 'left' }],                                    // doors on a side wall
    rear: [{ at: 'aisle', index: 0 }, { at: 'center' }]                   // doors on the back wall
  }
}
```

- `aislesAfter` lists how many seats come before each aisle. `lead` adds empty columns before a row's first seat so uneven rows stay aligned.
- `tail` adds a strip after the last seat that is `cols` seats wide: `kind: 'stairs'` (consecutive rows join into one flight) or `'platform'` (shows loose chairs).
- A front door can be on one side only, e.g. `front: ['right']`.
- A seat's number is its id, so numbers must be unique within a classroom.

## Classroom notes

- **Venus** (112 seats) was surveyed from photos. Seat 1 is at the audience's right, and the map draws the room as seen facing the board.
- **Jupiter** (112 seats) is Venus mirrored: seat 1 at the left, front door on the left. It has not been photographed, so check it against the room.
- **Bhaskara** (252 seats): 10 rows of 24 in blocks of 6, plus a 4-seat block on rows 8-10. 24 loose chairs in front of row 1 and 8 on the platform at rows 6-7 have no numbers.
- To flip a hall, change `seatOneOn` / `frontDoor` in `twinHall(...)` in `js/data.js`.

## Tests

Smoke tests also cover weekly repetition, selected weekdays, invalid date ranges, and recurrence limits.


```
node tests/smoke-test.js
```
