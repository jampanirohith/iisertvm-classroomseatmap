-- Classrooms. Run after schema.sql; safe to run again.
insert into public.rooms (id, name, building, capacity) values
  ('lhc-jupiter', 'Jupiter', 'Lecture Hall Complex', 112),
  ('lhc-venus', 'Venus', 'Lecture Hall Complex', 112),
  ('lhc-bhaskara', 'Bhaskara', 'Lecture Hall Complex', 252),
  ('lhc-kaumudi', 'Kaumudi', 'Lecture Hall Complex', 228),
  ('lhc-aryabhatta', 'Aryabhatta', 'Lecture Hall Complex', 500)
on conflict (id) do update set name = excluded.name, building = excluded.building, capacity = excluded.capacity;
