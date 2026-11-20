-- IISER TVM Lecture Hall Complex: Varsha 2026 exam schedule (mid-sem and end-sem) for Bhaskara, Kaumudi, Jupiter and
-- Venus. Halls in other buildings are not part of this site. Run in the Supabase SQL editor.
--
-- One event per course per hall, exactly as the seating plans list them. Codes joined by "/" are ONE course offered to
-- different programmes (e.g. "DSC 323 / MAT 314 / MSM 405"). Different courses that share a hall at the same time are
-- separate events (e.g. "HUM 212" and "I2M 411 / MAT 4511" in Jupiter, 23 Nov, 14:00-17:00); they share the hall's seat map.
--
-- What it does, in one transaction:
--   1. Lets exams of different courses share a hall at the same time (same rule as the updated schema.sql).
--      Classes and other events still cannot overlap anything.
--   2. Replaces the exam events dated 19-26 Sep 2026 and 18 Nov - 1 Dec 2026 with the list below. An event that is
--      already exactly right is kept, so students' seat marks on it survive a re-run; events that changed are removed.
--   Classes and other events are never touched. Safe to run again.
--   Mid-sem: Sat 19 Sep - Sat 26 Sep, 08:30-10:30, 11:30-13:30, 15:00-17:00.
--   End-sem: Wed 18 Nov - Tue 1 Dec, 09:00-12:00, 14:00-17:00.

begin;

-- 1. Room rules: classes and other events need the room to themselves; exams of different courses may share it.
create extension if not exists btree_gist;
alter table public.events drop constraint if exists events_no_overlap_per_room;
alter table public.events drop constraint if exists events_exam_apart_from_others;
do $$
begin
  alter table public.events add constraint events_no_overlap_per_room
    exclude using gist (room_id with =, tsrange(event_date + start_time, event_date + end_time, '[)') with &&)
    where (event_type <> 'exam');
exception
  when duplicate_object then null;
  when others then raise notice 'events_no_overlap_per_room was not added: %', sqlerrm;
end $$;
do $$
begin
  alter table public.events add constraint events_exam_apart_from_others
    exclude using gist (room_id with =, tsrange(event_date + start_time, event_date + end_time, '[)') with &&,
                        (case when event_type = 'exam' then 1 else 0 end) with <>);
exception
  when duplicate_object then null;
  when others then raise notice 'events_exam_apart_from_others was not added: %', sqlerrm;
end $$;

-- 2. The exam schedule: one row per course per hall.
create temp table new_exams (room_id text, title text, event_date date, start_time time, end_time time, professor text) on commit drop;
insert into new_exams (room_id, title, event_date, start_time, end_time, professor) values
  ('lhc-bhaskara', 'HUM 312', date '2026-09-19', time '08:30', time '10:30', 'Dr. Piyush Parimoo'),
  ('lhc-jupiter', 'MSP 512 / PHY 421 / PHY 612', date '2026-09-19', time '08:30', time '10:30', 'Dr Amal Medhi'),
  ('lhc-kaumudi', 'HUM 312', date '2026-09-19', time '08:30', time '10:30', 'Dr. Piyush Parimoo'),
  ('lhc-kaumudi', 'MSP 512 / PHY 421 / PHY 612', date '2026-09-19', time '08:30', time '10:30', 'Dr Amal Medhi'),
  ('lhc-venus', 'CHY 5108 / MSC 5108', date '2026-09-19', time '08:30', time '10:30', 'Dr. Subhrajyoti Bhandary'),
  ('lhc-venus', 'MSP 512 / PHY 421 / PHY 612', date '2026-09-19', time '08:30', time '10:30', 'Dr Amal Medhi'),
  ('lhc-bhaskara', 'BIO 4124 / BIO 6124', date '2026-09-19', time '11:30', time '13:30', 'Dr Amrutha Swaminathan'),
  ('lhc-bhaskara', 'CHY 5101 / I2C 411', date '2026-09-19', time '11:30', time '13:30', 'Dr Rajendra Kurapati'),
  ('lhc-bhaskara', 'PHY 211', date '2026-09-19', time '15:00', time '17:00', 'Dr Deepshikha Jaiswal Nagar'),
  ('lhc-jupiter', 'BIO 4031 / CHY 4107 / EES 4202 / MSC 4105', date '2026-09-19', time '15:00', time '17:00', 'Dr. Sweta Raghavan, Dr Ayan Mukherjee'),
  ('lhc-jupiter', 'MAT 407 / MAT 4107 / MAT 6103 / MSM 511', date '2026-09-19', time '15:00', time '17:00', 'Dr. Abhijeet Ghanwat'),
  ('lhc-kaumudi', 'BIO 4031 / CHY 4107 / EES 4202 / MSC 4105', date '2026-09-19', time '15:00', time '17:00', 'Dr. Sweta Raghavan, Dr Ayan Mukherjee'),
  ('lhc-kaumudi', 'PHY 211', date '2026-09-19', time '15:00', time '17:00', 'Dr Deepshikha Jaiswal Nagar'),
  ('lhc-venus', 'MAT 407 / MAT 4107 / MAT 6103 / MSM 511', date '2026-09-19', time '15:00', time '17:00', 'Dr. Abhijeet Ghanwat'),
  ('lhc-jupiter', 'DSC 212', date '2026-09-21', time '08:30', time '10:30', 'Dr Saptarshi Bej'),
  ('lhc-jupiter', 'EES 211', date '2026-09-21', time '08:30', time '10:30', 'Dr Pramitha M, Dr Ashutosh Pandey'),
  ('lhc-kaumudi', 'DSC 212', date '2026-09-21', time '08:30', time '10:30', 'Dr Saptarshi Bej'),
  ('lhc-venus', 'EES 211', date '2026-09-21', time '08:30', time '10:30', 'Dr Pramitha M, Dr Ashutosh Pandey'),
  ('lhc-jupiter', 'DSC 322', date '2026-09-21', time '11:30', time '13:30', 'Dr Shyamal Ghosh'),
  ('lhc-kaumudi', 'PHY 212', date '2026-09-21', time '11:30', time '13:30', 'Dr Ravi Pant'),
  ('lhc-venus', 'PHY 212', date '2026-09-21', time '11:30', time '13:30', 'Dr Ravi Pant'),
  ('lhc-bhaskara', 'CHY 212', date '2026-09-21', time '15:00', time '17:00', 'Prof Kana M. Sureshan, Prof Sukhendu Mandal'),
  ('lhc-jupiter', 'CHY 323', date '2026-09-21', time '15:00', time '17:00', 'Dr Alagiri Kaliyamoorthy'),
  ('lhc-kaumudi', 'BIO 322 / BIO 622 / MSB 402', date '2026-09-21', time '15:00', time '17:00', 'Dr Karthik Chandiran'),
  ('lhc-kaumudi', 'CHY 212', date '2026-09-21', time '15:00', time '17:00', 'Prof Kana M. Sureshan, Prof Sukhendu Mandal'),
  ('lhc-venus', 'CHY 323', date '2026-09-21', time '15:00', time '17:00', 'Dr Alagiri Kaliyamoorthy'),
  ('lhc-venus', 'EES 318', date '2026-09-21', time '15:00', time '17:00', 'Prof. Sabu Joseph'),
  ('lhc-jupiter', 'CHY 211', date '2026-09-22', time '08:30', time '10:30', 'Prof Vinesh Vijayan'),
  ('lhc-jupiter', 'I2M 5013 / MAT 5013 / MSM 5013', date '2026-09-22', time '08:30', time '10:30', 'Prof M P Rajan'),
  ('lhc-kaumudi', 'CHY 211', date '2026-09-22', time '08:30', time '10:30', 'Prof Vinesh Vijayan'),
  ('lhc-venus', 'CHY 422 / MSC 506', date '2026-09-22', time '08:30', time '10:30', 'Dr A. Thirumurugan'),
  ('lhc-jupiter', 'CHY 611', date '2026-09-22', time '11:30', time '13:30', 'Prof Ajay Venugopal, Prof. Sukhendu Mandal'),
  ('lhc-jupiter', 'DSC 323 / MAT 314 / MSM 405', date '2026-09-22', time '11:30', time '13:30', 'Dr Nagaiah Chamakuri'),
  ('lhc-kaumudi', 'BIO 323 / BIO 623 / MSB 403', date '2026-09-22', time '11:30', time '13:30', 'Prof Tapas K. Manna'),
  ('lhc-venus', 'DSC 323 / MAT 314 / MSM 405', date '2026-09-22', time '11:30', time '13:30', 'Dr Nagaiah Chamakuri'),
  ('lhc-bhaskara', 'HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-jupiter', 'HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-kaumudi', 'HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-venus', 'HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-venus', 'MSP 412 / PHY 312 / PHY 3120', date '2026-09-22', time '15:00', time '17:00', 'Dr D. V. Senthilkumar'),
  ('lhc-jupiter', 'EES 6111 / EESA 421', date '2026-09-23', time '08:30', time '10:30', 'Prof. C. Gnanaseelan'),
  ('lhc-jupiter', 'MSP 428', date '2026-09-23', time '08:30', time '10:30', 'Dr Sreedhar B Dutta'),
  ('lhc-jupiter', 'PHY 4206 / PHY 6206', date '2026-09-23', time '08:30', time '10:30', 'Dr. Abhimanyu Susobhanan'),
  ('lhc-kaumudi', 'BIO 4006 / BIO 6006', date '2026-09-23', time '08:30', time '10:30', 'Dr Kamalakannan Vijayan'),
  ('lhc-kaumudi', 'CHY 4106 / MSC 4104', date '2026-09-23', time '08:30', time '10:30', 'Dr A Muthukrishnan, Dr Vijayamohanan Pillai'),
  ('lhc-kaumudi', 'PHY 4206 / PHY 6206', date '2026-09-23', time '08:30', time '10:30', 'Dr. Abhimanyu Susobhanan'),
  ('lhc-venus', 'EES 6111 / EESA 421', date '2026-09-23', time '08:30', time '10:30', 'Prof. C. Gnanaseelan'),
  ('lhc-venus', 'EESA 312', date '2026-09-23', time '08:30', time '10:30', 'Prof. C. Gnanaseelan'),
  ('lhc-venus', 'PHY 5215 / PHY 6215', date '2026-09-23', time '08:30', time '10:30', 'Dr Madhu Thalakulam'),
  ('lhc-jupiter', 'I2M 322 / MAT 3202 / MSM 4522', date '2026-09-23', time '11:30', time '13:30', 'Dr Sudarshan Kumar K'),
  ('lhc-jupiter', 'I2M 411 / MAT 4511', date '2026-09-23', time '11:30', time '13:30', 'Prof Utpal Manna'),
  ('lhc-kaumudi', 'EES 212', date '2026-09-23', time '11:30', time '13:30', 'Dr Fousiya A A'),
  ('lhc-venus', 'I2M 322 / MAT 3202 / MSM 4522', date '2026-09-23', time '11:30', time '13:30', 'Dr Sudarshan Kumar K'),
  ('lhc-bhaskara', 'BIO 3005 / BIO 321 / BIO 621 / MSB 401', date '2026-09-23', time '15:00', time '17:00', 'Dr Ramanathan Natesh'),
  ('lhc-jupiter', 'MAT 5514 / MAT 6102 / MSM 514', date '2026-09-23', time '15:00', time '17:00', 'Dr Mitra Koley'),
  ('lhc-jupiter', 'MSC 402', date '2026-09-23', time '15:00', time '17:00', 'Dr Subrata Kundu'),
  ('lhc-kaumudi', 'BIO 3015 / BIO 6027', date '2026-09-23', time '15:00', time '17:00', 'Dr Ravi Maruthachalam, Dr. Boominathan Mohanasundaram, Dr Anirban Guha'),
  ('lhc-kaumudi', 'DSC 423', date '2026-09-23', time '15:00', time '17:00', 'Dr. Zakaria Laskar'),
  ('lhc-kaumudi', 'EES 6109 / EESA 419', date '2026-09-23', time '15:00', time '17:00', 'Dr Thiruvengadam P'),
  ('lhc-bhaskara', 'MAT 414 / MAT 4514 / MAT 6104 / MSM 513', date '2026-09-24', time '08:30', time '10:30', 'Dr Dhanya Rajendran'),
  ('lhc-bhaskara', 'MSP 422 / PHY 322 / PHY 622', date '2026-09-24', time '08:30', time '10:30', 'Dr Suraj S Hegde'),
  ('lhc-jupiter', 'BIO 212', date '2026-09-24', time '08:30', time '10:30', 'Dr V Stalin Raj'),
  ('lhc-kaumudi', 'BIO 212', date '2026-09-24', time '08:30', time '10:30', 'Dr V Stalin Raj'),
  ('lhc-venus', 'MSP 422 / PHY 322 / PHY 622', date '2026-09-24', time '08:30', time '10:30', 'Dr Suraj S Hegde'),
  ('lhc-jupiter', 'MAT 202', date '2026-09-24', time '11:30', time '13:30', 'Prof. P Devaraj'),
  ('lhc-kaumudi', 'MAT 202', date '2026-09-24', time '11:30', time '13:30', 'Prof. P Devaraj'),
  ('lhc-venus', 'MAT 202', date '2026-09-24', time '11:30', time '13:30', 'Prof. P Devaraj'),
  ('lhc-bhaskara', 'BIO 511 / BIO 611 / MSB 501', date '2026-09-24', time '15:00', time '17:00', 'Dr Jishy Varghese'),
  ('lhc-bhaskara', 'CHY 3202 / CHY 322', date '2026-09-24', time '15:00', time '17:00', 'Dr Gokulnath Sabapathi'),
  ('lhc-jupiter', 'MAT 304 / MAT 3504 / MSM 402', date '2026-09-24', time '15:00', time '17:00', 'Dr Geetha Thangavelu, Dr Saikat Chatterjee'),
  ('lhc-jupiter', 'PHY 5236 / PHY 6236', date '2026-09-24', time '15:00', time '17:00', 'Dr Krishnendu Gope'),
  ('lhc-kaumudi', 'CHY 3202 / CHY 322', date '2026-09-24', time '15:00', time '17:00', 'Dr Gokulnath Sabapathi'),
  ('lhc-kaumudi', 'MAT 304 / MAT 3504 / MSM 402', date '2026-09-24', time '15:00', time '17:00', 'Dr Geetha Thangavelu, Dr Saikat Chatterjee'),
  ('lhc-venus', 'PHY 5128 / PHY 6128', date '2026-09-24', time '15:00', time '17:00', 'Dr Sreedhar B Dutta'),
  ('lhc-jupiter', 'BIO 4126 / BIO 6126', date '2026-09-25', time '08:30', time '10:30', 'Dr Sabari Sankar Thirupathy'),
  ('lhc-jupiter', 'CHY 324 / CHY 624', date '2026-09-25', time '08:30', time '10:30', 'Dr Adithya Lakshmanna'),
  ('lhc-kaumudi', 'BIO 4126 / BIO 6126', date '2026-09-25', time '08:30', time '10:30', 'Dr Sabari Sankar Thirupathy'),
  ('lhc-kaumudi', 'MAT 313 / MSM 404', date '2026-09-25', time '08:30', time '10:30', 'Dr Jyothsna S'),
  ('lhc-venus', 'CHY 5107 / MSC 5107', date '2026-09-25', time '08:30', time '10:30', 'Dr Vennapusa Sivaranjana Reddy, Prof R. S. Swathi, Dr Pushpita Ghosh'),
  ('lhc-jupiter', 'BIO 211', date '2026-09-25', time '11:30', time '13:30', 'Prof Hema Somanathan, Dr Nitin Uttam Kamble'),
  ('lhc-kaumudi', 'BIO 211', date '2026-09-25', time '11:30', time '13:30', 'Prof Hema Somanathan, Dr Nitin Uttam Kamble'),
  ('lhc-bhaskara', 'MAT 303 / MSM 401', date '2026-09-25', time '15:00', time '17:00', 'Dr. Jayanta Sarkar'),
  ('lhc-bhaskara', 'MAT 421 / MSM 512', date '2026-09-25', time '15:00', time '17:00', 'Dr K. R Arun'),
  ('lhc-jupiter', 'CHY 5219', date '2026-09-25', time '15:00', time '17:00', 'Dr A Muthukrishnan'),
  ('lhc-jupiter', 'EES 321 / EES 6101', date '2026-09-25', time '15:00', time '17:00', 'Dr Rebekah S'),
  ('lhc-jupiter', 'HUM 412', date '2026-09-25', time '15:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-kaumudi', 'BIO 4026 / BIO 6026', date '2026-09-25', time '15:00', time '17:00', 'Dr Ravi Maruthachalam'),
  ('lhc-kaumudi', 'MAT 421 / MSM 512', date '2026-09-25', time '15:00', time '17:00', 'Dr K. R Arun'),
  ('lhc-kaumudi', 'MSC 403', date '2026-09-25', time '15:00', time '17:00', 'Dr Soumen De'),
  ('lhc-venus', 'EES 321 / EES 6101', date '2026-09-25', time '15:00', time '17:00', 'Dr Rebekah S'),
  ('lhc-venus', 'PHY 5233 / PHY 6223', date '2026-09-25', time '15:00', time '17:00', 'Prof Joy Mitra'),
  ('lhc-jupiter', 'MSP 427 / PHY 327', date '2026-09-26', time '08:30', time '10:30', 'Dr Bindusar Sahoo'),
  ('lhc-kaumudi', 'AOE 3016 / BIO 416 / BIO 616 / MSB 502', date '2026-09-26', time '08:30', time '10:30', 'Dr Sandhya Ganesan'),
  ('lhc-venus', 'MSP 427 / PHY 327', date '2026-09-26', time '08:30', time '10:30', 'Dr Bindusar Sahoo'),
  ('lhc-jupiter', 'MAT 201', date '2026-09-26', time '11:30', time '13:30', 'Dr Dond Asha Kisan'),
  ('lhc-kaumudi', 'MAT 201', date '2026-09-26', time '11:30', time '13:30', 'Dr Dond Asha Kisan'),
  ('lhc-venus', 'MAT 201', date '2026-09-26', time '11:30', time '13:30', 'Dr Dond Asha Kisan'),
  ('lhc-bhaskara', 'CHY 321 / MSC 401', date '2026-09-26', time '15:00', time '17:00', 'Dr Ramaraj Ayyappan'),
  ('lhc-bhaskara', 'MSP 424 / PHY 324', date '2026-09-26', time '15:00', time '17:00', 'Dr. Solingyur Zimik Kachui'),
  ('lhc-jupiter', 'BIO 4111 / BIO 6111 / MSB 406', date '2026-09-26', time '15:00', time '17:00', 'Dr Sabari Sankar Thirupathy'),
  ('lhc-jupiter', 'MAT 321 / MAT 3521 / MSM 403', date '2026-09-26', time '15:00', time '17:00', 'Prof Viji Z. Thomas'),
  ('lhc-kaumudi', 'CHY 321 / MSC 401', date '2026-09-26', time '15:00', time '17:00', 'Dr Ramaraj Ayyappan'),
  ('lhc-kaumudi', 'MAT 321 / MAT 3521 / MSM 403', date '2026-09-26', time '15:00', time '17:00', 'Prof Viji Z. Thomas'),
  ('lhc-venus', 'BIO 4111 / BIO 6111 / MSB 406', date '2026-09-26', time '15:00', time '17:00', 'Dr Sabari Sankar Thirupathy'),
  ('lhc-jupiter', 'EES 320', date '2026-11-18', time '09:00', time '12:00', 'Prof. Sabu Joseph'),
  ('lhc-jupiter', 'MAT 5012 / MAT 6513', date '2026-11-18', time '09:00', time '12:00', 'Dr Shrihari Sridharan'),
  ('lhc-jupiter', 'MSP 427 / PHY 327', date '2026-11-18', time '09:00', time '12:00', 'Dr Bindusar Sahoo'),
  ('lhc-kaumudi', 'PHY 211', date '2026-11-18', time '09:00', time '12:00', 'Dr Deepshikha Jaiswal Nagar'),
  ('lhc-venus', 'I2M 4501 / MAT 4501', date '2026-11-18', time '09:00', time '12:00', 'Dr Sachindranath Jayaraman'),
  ('lhc-venus', 'PHY 211', date '2026-11-18', time '09:00', time '12:00', 'Dr Deepshikha Jaiswal Nagar'),
  ('lhc-bhaskara', 'CHY 404 / MSC 404', date '2026-11-18', time '14:00', time '17:00', 'Dr Vennapusa Sivaranjana Reddy'),
  ('lhc-bhaskara', 'MSP 511 / PHY 411 / PHY 4119 / PHY 611', date '2026-11-18', time '14:00', time '17:00', 'Dr Mathew Arun Thomas'),
  ('lhc-kaumudi', 'BIO 5015 / BIO 6015', date '2026-11-18', time '14:00', time '17:00', 'Dr Vijay Jayaraman, Dr Manish Kumar'),
  ('lhc-kaumudi', 'CHY 5106 / I2C 523', date '2026-11-18', time '14:00', time '17:00', 'Dr. Sreejith Jayasree Varma'),
  ('lhc-kaumudi', 'CHY 5108 / MSC 5108', date '2026-11-18', time '14:00', time '17:00', 'Dr. Subhrajyoti Bhandary'),
  ('lhc-venus', 'AOE 4304 / EES 4304 / EES 6304', date '2026-11-18', time '14:00', time '17:00', 'Dr Subhajit Ghosh'),
  ('lhc-venus', 'BIO 3011 / BIO 6011', date '2026-11-18', time '14:00', time '17:00', 'Prof Nishant K. T'),
  ('lhc-venus', 'BIO 3014', date '2026-11-18', time '14:00', time '17:00', 'Dr N. Sadananda Singh'),
  ('lhc-kaumudi', 'BIO 323 / BIO 623 / MSB 403', date '2026-11-19', time '09:00', time '12:00', 'Prof Tapas K. Manna'),
  ('lhc-venus', 'DSC 321', date '2026-11-19', time '09:00', time '12:00', 'Dr Dhanyamol Antony'),
  ('lhc-bhaskara', 'CHY 211', date '2026-11-19', time '14:00', time '17:00', 'Vinesh Vijayan'),
  ('lhc-kaumudi', 'PHY 4217 / PHY 6217', date '2026-11-19', time '14:00', time '17:00', 'Prof Anil Shaji'),
  ('lhc-kaumudi', 'PHY 5236 / PHY 6236', date '2026-11-19', time '14:00', time '17:00', 'Dr Krishnendu Gope'),
  ('lhc-venus', 'CHY 211', date '2026-11-19', time '14:00', time '17:00', 'Vinesh Vijayan'),
  ('lhc-venus', 'EES 6108 / EESA 417', date '2026-11-19', time '14:00', time '17:00', 'Dr Vishnu S Nair'),
  ('lhc-jupiter', 'MAT 313 / MSM 404', date '2026-11-20', time '09:00', time '12:00', 'Dr Jyothsna S'),
  ('lhc-kaumudi', 'MAT 313 / MSM 404', date '2026-11-20', time '09:00', time '12:00', 'Dr Jyothsna S'),
  ('lhc-kaumudi', 'MAT 421 / MSM 512', date '2026-11-20', time '09:00', time '12:00', 'Dr K. R Arun'),
  ('lhc-venus', 'MSC 402', date '2026-11-20', time '09:00', time '12:00', 'Dr Subrata Kundu'),
  ('lhc-venus', 'PHY 5128 / PHY 6128', date '2026-11-20', time '09:00', time '12:00', 'Dr Sreedhar B Dutta'),
  ('lhc-bhaskara', 'BIO 212', date '2026-11-20', time '14:00', time '17:00', 'Dr V Stalin Raj'),
  ('lhc-jupiter', 'BIO 4126 / BIO 6126', date '2026-11-20', time '14:00', time '17:00', 'Dr Sabari Sankar Thirupathy'),
  ('lhc-kaumudi', 'BIO 212', date '2026-11-20', time '14:00', time '17:00', 'Dr V Stalin Raj'),
  ('lhc-kaumudi', 'CHY 3202 / CHY 322', date '2026-11-20', time '14:00', time '17:00', 'Dr Gokulnath Sabapathi'),
  ('lhc-venus', 'CHY 5102 / CHY 6102', date '2026-11-20', time '14:00', time '17:00', 'Dr Ramesh Rasappan'),
  ('lhc-venus', 'EES 6109 / EESA 419', date '2026-11-20', time '14:00', time '17:00', 'Dr Thiruvengadam P'),
  ('lhc-jupiter', 'CHY 321 / MSC 401', date '2026-11-21', time '09:00', time '12:00', 'Dr Ramaraj Ayyappan'),
  ('lhc-kaumudi', 'DSC 211', date '2026-11-21', time '09:00', time '12:00', 'Dr Raji Susan Mathew'),
  ('lhc-venus', 'CHY 321 / MSC 401', date '2026-11-21', time '09:00', time '12:00', 'Dr Ramaraj Ayyappan'),
  ('lhc-venus', 'DSC 211', date '2026-11-21', time '09:00', time '12:00', 'Dr Raji Susan Mathew'),
  ('lhc-bhaskara', 'CHY 423 / MSC 507', date '2026-11-21', time '14:00', time '17:00', 'Prof R. S. Swathi'),
  ('lhc-bhaskara', 'MAT 407 / MAT 4107 / MAT 6103 / MSM 511', date '2026-11-21', time '14:00', time '17:00', 'Dr. Abhijeet Ghanwat'),
  ('lhc-jupiter', 'DSC 4110 / DSC 6111', date '2026-11-21', time '14:00', time '17:00', 'Dr. Laltu Sardar'),
  ('lhc-jupiter', 'EES 6111 / EESA 421', date '2026-11-21', time '14:00', time '17:00', 'Prof. C. Gnanaseelan'),
  ('lhc-kaumudi', 'EES 212', date '2026-11-21', time '14:00', time '17:00', 'Dr Fousiya A A'),
  ('lhc-kaumudi', 'EESA 311', date '2026-11-21', time '14:00', time '17:00', 'Dr N. Anand'),
  ('lhc-kaumudi', 'MSP 428', date '2026-11-21', time '14:00', time '17:00', 'Dr Sreedhar B Dutta'),
  ('lhc-venus', 'EES 212', date '2026-11-21', time '14:00', time '17:00', 'Dr Fousiya A A'),
  ('lhc-bhaskara', 'DSC 322', date '2026-11-22', time '09:00', time '12:00', 'Dr Shyamal Ghosh'),
  ('lhc-venus', 'EES 319 / EES 6112', date '2026-11-22', time '09:00', time '12:00', 'Dr Bhavya P S'),
  ('lhc-bhaskara', 'MAT 201', date '2026-11-22', time '14:00', time '17:00', 'Dr Dond Asha Kisan'),
  ('lhc-kaumudi', 'MAT 201', date '2026-11-22', time '14:00', time '17:00', 'Dr Dond Asha Kisan'),
  ('lhc-venus', 'PHY 4211 / PHY 6211', date '2026-11-22', time '14:00', time '17:00', 'Dr Tuhin Subhra Maity'),
  ('lhc-kaumudi', 'MSP 422 / PHY 322 / PHY 622', date '2026-11-23', time '09:00', time '12:00', 'Dr Suraj S Hegde'),
  ('lhc-venus', 'BIO 4006 / BIO 6006', date '2026-11-23', time '09:00', time '12:00', 'Dr Kamalakannan Vijayan'),
  ('lhc-venus', 'CHY 5104 / CHY 6101', date '2026-11-23', time '09:00', time '12:00', 'Vinesh Vijayan'),
  ('lhc-venus', 'MAT 6101', date '2026-11-23', time '09:00', time '12:00', 'Dr Shrihari Sridharan, Dr Sachindranath Jayaraman, Dr Prasuna Bandi'),
  ('lhc-bhaskara', 'HUM 212', date '2026-11-23', time '14:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-jupiter', 'HUM 212', date '2026-11-23', time '14:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-jupiter', 'I2M 411 / MAT 4511', date '2026-11-23', time '14:00', time '17:00', 'Prof Utpal Manna'),
  ('lhc-kaumudi', 'HUM 212', date '2026-11-23', time '14:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-venus', 'HUM 212', date '2026-11-23', time '14:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-jupiter', 'BIO 327 / BIO 627 / MSB 404', date '2026-11-25', time '09:00', time '12:00', 'Dr Yashraj Chavhan'),
  ('lhc-kaumudi', 'BIO 327 / BIO 627 / MSB 404', date '2026-11-25', time '09:00', time '12:00', 'Dr Yashraj Chavhan'),
  ('lhc-kaumudi', 'DSC 323 / MAT 314 / MSM 405', date '2026-11-25', time '09:00', time '12:00', 'Dr Nagaiah Chamakuri'),
  ('lhc-venus', 'BIO 327 / BIO 627 / MSB 404', date '2026-11-25', time '09:00', time '12:00', 'Dr Yashraj Chavhan'),
  ('lhc-venus', 'BIO 4021 / BIO 6021 / I2B 421', date '2026-11-25', time '09:00', time '12:00', 'Dr Sanu Shameer, Dr Bandan Chakrabortty'),
  ('lhc-bhaskara', 'CHY 212', date '2026-11-25', time '14:00', time '17:00', 'Prof Kana M. Sureshan, Prof Sukhendu Mandal'),
  ('lhc-bhaskara', 'MSP 412 / PHY 312 / PHY 3120', date '2026-11-25', time '14:00', time '17:00', 'Dr D. V. Senthilkumar'),
  ('lhc-jupiter', 'CHY 323', date '2026-11-25', time '14:00', time '17:00', 'Dr Alagiri Kaliyamoorthy'),
  ('lhc-jupiter', 'PHY 5212 / PHY 6212', date '2026-11-25', time '14:00', time '17:00', 'Dr. Soumik Bandyopadhyay'),
  ('lhc-kaumudi', 'CHY 212', date '2026-11-25', time '14:00', time '17:00', 'Prof Kana M. Sureshan, Prof Sukhendu Mandal'),
  ('lhc-venus', 'CHY 323', date '2026-11-25', time '14:00', time '17:00', 'Dr Alagiri Kaliyamoorthy'),
  ('lhc-kaumudi', 'BIO 3005 / BIO 321 / BIO 621 / MSB 401', date '2026-11-26', time '09:00', time '12:00', 'Dr Ramanathan Natesh'),
  ('lhc-venus', 'BIO 3005 / BIO 321 / BIO 621 / MSB 401', date '2026-11-26', time '09:00', time '12:00', 'Dr Ramanathan Natesh'),
  ('lhc-venus', 'CHY 5107 / MSC 5107', date '2026-11-26', time '09:00', time '12:00', 'Dr Vennapusa Sivaranjana Reddy, Prof R. S. Swathi, Dr Pushpita Ghosh'),
  ('lhc-bhaskara', 'DSC 212', date '2026-11-26', time '14:00', time '17:00', 'Dr Saptarshi Bej'),
  ('lhc-bhaskara', 'MSP 512 / PHY 421 / PHY 612', date '2026-11-26', time '14:00', time '17:00', 'Dr Amal Medhi'),
  ('lhc-jupiter', 'DSC 324 / DSC 3241', date '2026-11-26', time '14:00', time '17:00', 'Dr Alwin Poulose'),
  ('lhc-jupiter', 'MAT 414 / MAT 4514 / MAT 6104 / MSM 513', date '2026-11-26', time '14:00', time '17:00', 'Dhanya Rajendran'),
  ('lhc-kaumudi', 'DSC 212', date '2026-11-26', time '14:00', time '17:00', 'Dr Saptarshi Bej'),
  ('lhc-kaumudi', 'MAT 414 / MAT 4514 / MAT 6104 / MSM 513', date '2026-11-26', time '14:00', time '17:00', 'Dhanya Rajendran'),
  ('lhc-venus', 'MSP 512 / PHY 421 / PHY 612', date '2026-11-26', time '14:00', time '17:00', 'Dr Amal Medhi'),
  ('lhc-jupiter', 'HUM 312', date '2026-11-27', time '09:00', time '12:00', 'Dr. Piyush Parimoo'),
  ('lhc-kaumudi', 'BIO 511 / BIO 611 / MSB 501', date '2026-11-27', time '09:00', time '12:00', 'Dr Jishy Varghese'),
  ('lhc-venus', 'HUM 312', date '2026-11-27', time '09:00', time '12:00', 'Dr. Piyush Parimoo'),
  ('lhc-bhaskara', 'MAT 202', date '2026-11-27', time '14:00', time '17:00', 'Prof. P Devaraj'),
  ('lhc-jupiter', 'CHY 421 / MSC 505', date '2026-11-27', time '14:00', time '17:00', 'Dr Veera Reddy Yatham'),
  ('lhc-kaumudi', 'MAT 202', date '2026-11-27', time '14:00', time '17:00', 'Prof. P Devaraj'),
  ('lhc-venus', 'CHY 421 / MSC 505', date '2026-11-27', time '14:00', time '17:00', 'Dr Veera Reddy Yatham'),
  ('lhc-bhaskara', 'CHY 324 / CHY 624', date '2026-11-28', time '09:00', time '12:00', 'Dr Adithya Lakshmanna'),
  ('lhc-bhaskara', 'CHY 422 / MSC 506', date '2026-11-28', time '09:00', time '12:00', 'Dr A. Thirumurugan'),
  ('lhc-jupiter', 'BIO 4026 / BIO 6026', date '2026-11-28', time '09:00', time '12:00', 'Dr Ravi Maruthachalam'),
  ('lhc-kaumudi', 'BIO 211', date '2026-11-28', time '09:00', time '12:00', 'Prof Hema Somanathan, Dr Nitin Uttam Kamble'),
  ('lhc-venus', 'BIO 211', date '2026-11-28', time '09:00', time '12:00', 'Prof Hema Somanathan, Dr Nitin Uttam Kamble'),
  ('lhc-bhaskara', 'MSP 424 / PHY 324', date '2026-11-28', time '14:00', time '17:00', 'Dr. Solingyur Zimik Kachui'),
  ('lhc-jupiter', 'MSC 403', date '2026-11-28', time '14:00', time '17:00', 'Dr Soumen De'),
  ('lhc-kaumudi', 'MAT 321 / MAT 3521 / MSM 403', date '2026-11-28', time '14:00', time '17:00', 'Prof Viji Z. Thomas'),
  ('lhc-bhaskara', 'PHY 212', date '2026-11-29', time '09:00', time '12:00', 'Dr Ravi Pant'),
  ('lhc-kaumudi', 'AOE 3016 / BIO 416 / BIO 616 / MSB 502', date '2026-11-29', time '09:00', time '12:00', 'Dr Sandhya Ganesan'),
  ('lhc-venus', 'PHY 212', date '2026-11-29', time '09:00', time '12:00', 'Dr Ravi Pant'),
  ('lhc-kaumudi', 'AOE 4305 / EES 4305 / EES 6305', date '2026-11-30', time '09:00', time '12:00', 'Dr Arathy Ravindran'),
  ('lhc-kaumudi', 'CHY 4103 / I2C 413 / I2C 422', date '2026-11-30', time '09:00', time '12:00', 'Dr Rajendra Kurapati'),
  ('lhc-kaumudi', 'CHY 5219', date '2026-11-30', time '09:00', time '12:00', 'Dr A Muthukrishnan'),
  ('lhc-kaumudi', 'DSC 4111 / DSC 421', date '2026-11-30', time '14:00', time '17:00', 'Dr Masihuddin'),
  ('lhc-kaumudi', 'MAT 304 / MAT 3504 / MSM 402', date '2026-11-30', time '14:00', time '17:00', 'Dr Geetha Thangavelu, Dr Saikat Chatterjee'),
  ('lhc-venus', 'MAT 5514 / MAT 6102 / MSM 514', date '2026-11-30', time '14:00', time '17:00', 'Dr Mitra Koley'),
  ('lhc-venus', 'PHY 5217 / PHY 6218', date '2026-11-30', time '14:00', time '17:00', 'Dr Shabnam Iyyani'),
  ('lhc-jupiter', 'CHY 3206 / I2C 312', date '2026-12-01', time '09:00', time '12:00', 'Prof Reji Varghese'),
  ('lhc-jupiter', 'MAT 303 / MSM 401', date '2026-12-01', time '09:00', time '12:00', 'Dr Shrihari Sridharan, Dr. Jayanta Sarkar'),
  ('lhc-kaumudi', 'BIO 4111 / BIO 6111 / MSB 406', date '2026-12-01', time '09:00', time '12:00', 'Dr Sabari Sankar Thirupathy'),
  ('lhc-kaumudi', 'CHY 5206 / CHY 6206', date '2026-12-01', time '09:00', time '12:00', 'Dr Milan Kumar Bisai'),
  ('lhc-venus', 'MAT 303 / MSM 401', date '2026-12-01', time '09:00', time '12:00', 'Dr Shrihari Sridharan, Dr. Jayanta Sarkar'),
  ('lhc-bhaskara', 'I2M 404 / MAT 4504 / MAT 6105', date '2026-12-01', time '14:00', time '17:00', 'Dr Dharmatti Sheetal'),
  ('lhc-bhaskara', 'MAT 5011 / MAT 6512', date '2026-12-01', time '14:00', time '17:00', 'Dr Geetha Thangavelu, Dr Saikat Chatterjee'),
  ('lhc-bhaskara', 'MSC 4101', date '2026-12-01', time '14:00', time '17:00', 'Dr Ayan Mukherjee, Dr. Sreejith Jayasree Varma'),
  ('lhc-bhaskara', 'MSC 4102', date '2026-12-01', time '14:00', time '17:00', 'Dr Jerry A. Fereiro'),
  ('lhc-bhaskara', 'PHY 5215 / PHY 6215', date '2026-12-01', time '14:00', time '17:00', 'Dr Madhu Thalakulam');

-- Remove the exam events of these two periods that are not in the list (the old merged ones, anything added by hand).
delete from public.events e
where e.event_type = 'exam'
  and (e.event_date between date '2026-09-19' and date '2026-09-26'
    or e.event_date between date '2026-11-18' and date '2026-12-01')
  and not exists (select 1 from new_exams n
                  where n.room_id = e.room_id and n.title = e.title and n.event_date = e.event_date
                    and n.start_time = e.start_time and n.end_time = e.end_time);

-- Keep the events that are already right (and their seat marks); only the faculty name may change.
update public.events e set professor = n.professor
from new_exams n
where e.event_type = 'exam' and n.room_id = e.room_id and n.title = e.title and n.event_date = e.event_date
  and n.start_time = e.start_time and n.end_time = e.end_time and e.professor is distinct from n.professor;

-- Add the events that are missing.
insert into public.events (room_id, title, event_type, event_date, start_time, end_time, professor, created_by)
select n.room_id, n.title, 'exam', n.event_date, n.start_time, n.end_time, n.professor, 'admin'
from new_exams n
where not exists (select 1 from public.events e
                  where e.event_type = 'exam' and e.room_id = n.room_id and e.title = n.title and e.event_date = n.event_date
                    and e.start_time = n.start_time and e.end_time = n.end_time);

commit;

-- Check: exam events per hall (Bhaskara 38, Jupiter 54, Kaumudi 68, Venus 58 for the two periods).
select r.name as hall, count(e.id) as exams
from public.rooms r left join public.events e on e.room_id = r.id and e.event_type = 'exam'
group by r.name order by r.name;
