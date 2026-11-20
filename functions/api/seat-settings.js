import { getSeatSettings } from '../_shared/admin-auth.js';

// Public: the seat-marking rules the classroom page follows (no secrets, just the two choices).
export async function onRequestGet({ env }) {
  const { seatMarking, seatNames } = await getSeatSettings(env);
  return Response.json({ marking: seatMarking, names: seatNames }, {
    headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
  });
}
