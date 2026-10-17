(function () {
  'use strict';
  const seq = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  const rev = list => list.slice().reverse();

  // Jupiter and Venus are twin halls (mirror images of each other on the floor plan):
  // 8 rows of 14 numbered seats = 112, in blocks of 4 | 6 | 4 with a stair aisle between blocks.
  // Numbers snake from row to row, and row 1 starts at the wall where seat 1 is (`seatOneOn`).
  // Both rear doors sit at the two stair aisles; the single front door is beside the board on the `frontDoor` side.
  // Venus was surveyed from photos (seat 1 at the audience's right). Jupiter mirrors it and has not been photographed.
  const twinHall = ({ seatOneOn, frontDoor }) => ({
    rows: Array.from({ length: 8 }, (_, r) => {
      const run = seq(r * 14 + 1, r * 14 + 14);               // seat numbers in the direction the row is numbered
      const startsAtSeatOneWall = r % 2 === 0;
      const seats = (startsAtSeatOneWall === (seatOneOn === 'left')) ? run : rev(run);
      return { seats, lead: 0, aislesAfter: [4, 10] };
    }),
    aisleLabel: 'STAIRS',
    exits: { front: [frontDoor], rear: [{ at: 'aisle', index: 0 }, { at: 'aisle', index: 1 }] }
  });

  // Bhaskara: 252 numbered seats. Facing the board, left to right:
  //   side steps | block D | aisle | block C | aisle | block B | aisle | block A | right-hand strip
  // Rows 1-10 each hold 24 seats (four blocks of 6). Numbers snake from row to row and seat 1 is at the
  // audience's right, next to the wide side stairs. Odd rows therefore read 24..1 and even rows 25..48 left to right.
  // The right-hand strip is the side stairs (rows 1-5), a platform with 4 loose chairs (rows 6-7) and a separate
  // 4-seat x 3-row block, seats 241-252 (rows 8-10), which continues the same snake.
  // 24 loose writing-arm chairs stand on the floor in front of row 1; they are not numbered.
  const bhaskara = () => {
    const sideBlock = k => { const run = seq(241 + k * 4, 244 + k * 4); return k % 2 === 0 ? rev(run) : run; };
    const rows = Array.from({ length: 10 }, (_, r) => {
      const run = seq(r * 24 + 1, r * 24 + 24);
      const main = r % 2 === 0 ? rev(run) : run;
      if (r >= 7) return { seats: main.concat(sideBlock(r - 7)), lead: 1, aislesAfter: [6, 12, 18, 24] };
      return { seats: main, lead: 1, aislesAfter: [6, 12, 18], tail: { kind: r < 5 ? 'stairs' : 'platform', cols: 4 } };
    });
    return {
      rows,
      sideStairs: { side: 'left', fromRow: 0, toRow: 9 },
      aisleLabel: 'STAIRS',
      board: { from: 1, to: 2 },
      looseChairs: { segments: 4 },
      exits: {
        front: ['left', 'right'],
        rear: [{ at: 'aisle', index: 0 }, { at: 'aisle', index: 2 }]
      }
    };
  };

  // Kaumudi: 228 seats in 14 rows, numbered like the plates on the desks (they snake from row to row).
  // Facing the board each row is: side block | stairs | centre 8 | stairs | right 4.
  // The side block, next to the side stairs, has 4 seats in rows 1-9, 3 in rows 10-11 and 6 in rows 12-14.
  // `lead` is the number of empty columns before a row's first seat, so every block lines up on every row.
  const kaumudi = () => {
    const sideBlock = [4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 6, 6, 6];
    let next = 1;
    const rows = sideBlock.map((side, i) => {
      const count = side + 12;
      const seats = seq(next, next + count - 1);
      next += count;
      if (i % 2 === 1) seats.reverse();
      return { seats, lead: 6 - side, aislesAfter: [side, side + 8] };
    });
    return {
      rows,
      sideStairs: { side: 'left', fromRow: 0, toRow: 10 },
      aisleLabel: 'STAIRS',
      exits: {
        front: ['left', 'right'],
        sides: [{ row: 1, side: 'left' }],
        rear: [{ at: 'aisle', index: 0 }, { at: 'aisle', index: 1 }]
      }
    };
  };

  // layout: null means the seating arrangement has not been confirmed yet.
  window.LHC_ROOMS = [
    { id: 'lhc-jupiter', name: 'Jupiter', capacity: 112, layout: twinHall({ seatOneOn: 'left', frontDoor: 'left' }) },
    { id: 'lhc-venus', name: 'Venus', capacity: 112, layout: twinHall({ seatOneOn: 'right', frontDoor: 'right' }) },
    { id: 'lhc-bhaskara', name: 'Bhaskara', capacity: 252, layout: bhaskara() },
    { id: 'lhc-kaumudi', name: 'Kaumudi', capacity: 228, layout: kaumudi() },
    { id: 'lhc-aryabhatta', name: 'Aryabhatta', capacity: 500, layout: null }
  ];
})();
