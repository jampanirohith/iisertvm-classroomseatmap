-- IISER TVM Lecture Hall Complex: Varsha 2026 Mid Semester Examination hall allocation.
-- Run in the Supabase SQL editor. It adds one exam event per exam, per hall, for the four lecture halls
-- (Bhaskara, Kaumudi, Jupiter, Venus); halls in other buildings (CSB, PSB, BSB, MSB, Madhava, ...) are not part of this site.
-- Exams ran Sat 19 Sep to Sat 26 Sep 2026 in three slots: 08:30-10:30, 11:30-13:30 and 15:00-17:00.
-- It first clears any exam events dated 19-26 Sep 2026, so it is safe to run again. Classes and other events are untouched.

begin;

delete from public.events
where event_type = 'exam' and event_date between date '2026-09-19' and date '2026-09-26';

insert into public.events (room_id, title, event_type, event_date, start_time, end_time, professor, description, created_by)
select room_id, title, 'exam', event_date, start_time, end_time, professor, description, 'admin'
from (values
  ('lhc-bhaskara', 'Mid-Sem Exam: HUM 312', date '2026-09-19', time '08:30', time '10:30', 'Dr. Piyush Parimoo', 'Mid Semester Examination. HUM 312: 126 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MSP 512', date '2026-09-19', time '08:30', time '10:30', 'Dr Amal Medhi', 'Mid Semester Examination. MSP 512 / PHY 421 / PHY 612: 56 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: HUM 312, MSP 512', date '2026-09-19', time '08:30', time '10:30', 'Dr. Piyush Parimoo; Dr Amal Medhi', 'Mid Semester Examination. HUM 312: 85 students; MSP 512 / PHY 421 / PHY 612: 28 students'),
  ('lhc-venus', 'Mid-Sem Exam: MSP 512, CHY 5108', date '2026-09-19', time '08:30', time '10:30', 'Dr Amal Medhi; Dr. Subhrajyoti Bhandary', 'Mid Semester Examination. MSP 512 / PHY 421 / PHY 612: 17 students; CHY 5108 / MSC 5108: 38 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: CHY 5101, BIO 4124', date '2026-09-19', time '11:30', time '13:30', 'Dr Rajendra Kurapati; Dr Amrutha Swaminathan', 'Mid Semester Examination. CHY 5101 / I 2C411: 51 students; BIO 4124 / BIO 6124: 36 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: PHY 211', date '2026-09-19', time '15:00', time '17:00', 'Dr Deepshikha Jaiswal Nagar', 'Mid Semester Examination. PHY 211: 126 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: BIO 4031, MAT 407', date '2026-09-19', time '15:00', time '17:00', 'Dr. Sweta Raghavan, Dr Ayan Mukherjee; Dr. Abhijeet Ghanwat', 'Mid Semester Examination. BIO 4031 / CHY 4107 / EES 4202 / MSC 4105: 20 students; MAT 407 / MAT 4107 / MAT 6103 / MSM 511: 36 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: PHY 211, BIO 4031', date '2026-09-19', time '15:00', time '17:00', 'Dr Deepshikha Jaiswal Nagar; Dr. Sweta Raghavan, Dr Ayan Mukherjee', 'Mid Semester Examination. PHY 211: 29 students; BIO 4031 / CHY 4107 / EES 4202 / MSC 4105: 85 students'),
  ('lhc-venus', 'Mid-Sem Exam: MAT 407', date '2026-09-19', time '15:00', time '17:00', 'Dr. Abhijeet Ghanwat', 'Mid Semester Examination. MAT 407 / MAT 4107 / MAT 6103 / MSM 511: 34 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: DSC 212, EES 211', date '2026-09-21', time '08:30', time '10:30', 'Dr Saptarshi Bej; Dr Pramitha M, Dr Ashutosh Pandey', 'Mid Semester Examination. DSC 212: 33 students; EES 211: 23 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: DSC 212', date '2026-09-21', time '08:30', time '10:30', 'Dr Saptarshi Bej', 'Mid Semester Examination. DSC 212: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: EES 211', date '2026-09-21', time '08:30', time '10:30', 'Dr Pramitha M, Dr Ashutosh Pandey', 'Mid Semester Examination. EES 211: 56 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: DSC 322', date '2026-09-21', time '11:30', time '13:30', 'Dr Shyamal Ghosh', 'Mid Semester Examination. DSC 322: 26 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: PHY 212', date '2026-09-21', time '11:30', time '13:30', 'Dr Ravi Pant', 'Mid Semester Examination. PHY 212: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: PHY 212', date '2026-09-21', time '11:30', time '13:30', 'Dr Ravi Pant', 'Mid Semester Examination. PHY 212: 39 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: CHY 212', date '2026-09-21', time '15:00', time '17:00', 'Prof Kana M. Sureshan, Prof Sukhendu Mandal', 'Mid Semester Examination. CHY 212: 126 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: CHY 323', date '2026-09-21', time '15:00', time '17:00', 'Dr Alagiri Kaliyamoorthy', 'Mid Semester Examination. CHY 323: 56 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: CHY 212, BIO 322', date '2026-09-21', time '15:00', time '17:00', 'Prof Kana M. Sureshan, Prof Sukhendu Mandal; Dr Karthik Chandiran', 'Mid Semester Examination. CHY 212: 5 students; BIO 322 / BIO 622 / MSB 402: 102 students'),
  ('lhc-venus', 'Mid-Sem Exam: CHY 323, EES 318', date '2026-09-21', time '15:00', time '17:00', 'Dr Alagiri Kaliyamoorthy; Prof. Sabu Joseph', 'Mid Semester Examination. CHY 323: 9 students; EES 318: 19 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: CHY 211, I 2M5013', date '2026-09-22', time '08:30', time '10:30', 'Prof Vinesh Vijayan; Prof M P Rajan', 'Mid Semester Examination. CHY 211: 30 students; I 2M5013 / MAT 5013 / MSM 5013: 23 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: CHY 211', date '2026-09-22', time '08:30', time '10:30', 'Prof Vinesh Vijayan', 'Mid Semester Examination. CHY 211: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: CHY 422', date '2026-09-22', time '08:30', time '10:30', 'Dr A. Thirumurugan', 'Mid Semester Examination. CHY 422 / MSC 506: 56 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: DSC 323, CHY 611', date '2026-09-22', time '11:30', time '13:30', 'Dr Nagaiah Chamakuri; Prof Ajay Venugopal, Prof. Sukhendu Mandal', 'Mid Semester Examination. DSC 323 / MAT 314 / MSM 405: 42 students; CHY 611: 7 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: BIO 323', date '2026-09-22', time '11:30', time '13:30', 'Prof Tapas K. Manna', 'Mid Semester Examination. BIO 323 / BIO 623 / MSB 403: 108 students'),
  ('lhc-venus', 'Mid-Sem Exam: DSC 323', date '2026-09-22', time '11:30', time '13:30', 'Dr Nagaiah Chamakuri', 'Mid Semester Examination. DSC 323 / MAT 314 / MSM 405: 56 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo', 'Mid Semester Examination. HUM 212: 126 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo', 'Mid Semester Examination. HUM 212: 56 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: HUM 212', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo', 'Mid Semester Examination. HUM 212: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: HUM 212, MSP 412', date '2026-09-22', time '15:00', time '17:00', 'Dr. Piyush Parimoo; Dr D. V. Senthilkumar', 'Mid Semester Examination. HUM 212: 8 students; MSP 412 / PHY 312 / PHY 3120: 48 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: PHY 4206, MSP 428, EES 6111', date '2026-09-23', time '08:30', time '10:30', 'Dr. Abhimanyu Susobhanan; Dr Sreedhar B Dutta; Prof. C. Gnanaseelan', 'Mid Semester Examination. PHY 4206 / PHY 6206: 22 students; MSP 428: 28 students; EES 6111 / EESA 421: 6 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: CHY 4106, BIO 4006, PHY 4206', date '2026-09-23', time '08:30', time '10:30', 'Dr A Muthukrishnan, Dr Vijayamohanan Pillai; Dr Kamalakannan Vijayan; Dr. Abhimanyu Susobhanan', 'Mid Semester Examination. CHY 4106 / MSC 4104: 57 students; BIO 4006 / BIO 6006: 44 students; PHY 4206 / PHY 6206: 13 students'),
  ('lhc-venus', 'Mid-Sem Exam: EES 6111, EESA 312, PHY 5215', date '2026-09-23', time '08:30', time '10:30', 'Prof. C. Gnanaseelan; Dr Madhu Thalakulam', 'Mid Semester Examination. EES 6111 / EESA 421: 16 students; EESA 312: 20 students; PHY 5215 / PHY 6215: 12 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: I 2M322, I 2M411', date '2026-09-23', time '11:30', time '13:30', 'Dr Sudarshan Kumar K; Prof Utpal Manna', 'Mid Semester Examination. I 2M322 / MAT 3202 / MSM 4522: 4 students; I 2M411 / MAT 4511: 44 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: EES 212', date '2026-09-23', time '11:30', time '13:30', 'Dr Fousiya A A', 'Mid Semester Examination. EES 212: 101 students'),
  ('lhc-venus', 'Mid-Sem Exam: I 2M322', date '2026-09-23', time '11:30', time '13:30', 'Dr Sudarshan Kumar K', 'Mid Semester Examination. I 2M322 / MAT 3202 / MSM 4522: 56 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: BIO 3005', date '2026-09-23', time '15:00', time '17:00', 'Dr Ramanathan Natesh', 'Mid Semester Examination. BIO 3005 / BIO 321 / BIO 621 / MSB 401: 125 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MSC 402, MAT 5514', date '2026-09-23', time '15:00', time '17:00', 'Dr Subrata Kundu; Dr Mitra Koley', 'Mid Semester Examination. MSC 402: 27 students; MAT 5514 / MAT 6102 / MSM 514: 25 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: DSC 423, EES 6109, BIO 3015', date '2026-09-23', time '15:00', time '17:00', 'Dr. Zakaria Laskar; Dr Thiruvengadam P; Dr Ravi Maruthachalam, Dr. Boominathan Mohanasundaram, Dr Anirban Guha', 'Mid Semester Examination. DSC 423: 57 students; EES 6109 / EESA 419: 23 students; BIO 3015 / BIO 6027: 10 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: MSP 422, MAT 414', date '2026-09-24', time '08:30', time '10:30', 'Dr Suraj S Hegde; Dr Dhanya Rajendran', 'Mid Semester Examination. MSP 422 / PHY 322 / PHY 622: 58 students; MAT 414 / MAT 4514 / MAT 6104 / MSM 513: 61 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: BIO 212', date '2026-09-24', time '08:30', time '10:30', 'Dr V Stalin Raj', 'Mid Semester Examination. BIO 212: 49 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: BIO 212', date '2026-09-24', time '08:30', time '10:30', 'Dr V Stalin Raj', 'Mid Semester Examination. BIO 212: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: MSP 422', date '2026-09-24', time '08:30', time '10:30', 'Dr Suraj S Hegde', 'Mid Semester Examination. MSP 422 / PHY 322 / PHY 622: 56 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MAT 202', date '2026-09-24', time '11:30', time '13:30', 'Prof. P Devaraj', 'Mid Semester Examination. MAT 202: 52 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: MAT 202', date '2026-09-24', time '11:30', time '13:30', 'Prof. P Devaraj', 'Mid Semester Examination. MAT 202: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: MAT 202', date '2026-09-24', time '11:30', time '13:30', 'Prof. P Devaraj', 'Mid Semester Examination. MAT 202: 56 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: BIO 511, CHY 3202', date '2026-09-24', time '15:00', time '17:00', 'Dr Jishy Varghese; Dr Gokulnath Sabapathi', 'Mid Semester Examination. BIO 511 / BIO 611 / MSB 501: 106 students; CHY 3202 / CHY 322: 20 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MAT 304, PHY 5236', date '2026-09-24', time '15:00', time '17:00', 'Dr Geetha Thangavelu, Dr Saikat Chatterjee; Dr Krishnendu Gope', 'Mid Semester Examination. MAT 304 / MAT 3504 / MSM 402: 3 students; PHY 5236 / PHY 6236: 32 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: CHY 3202, MAT 304', date '2026-09-24', time '15:00', time '17:00', 'Dr Gokulnath Sabapathi; Dr Geetha Thangavelu, Dr Saikat Chatterjee', 'Mid Semester Examination. CHY 3202 / CHY 322: 53 students; MAT 304 / MAT 3504 / MSM 402: 61 students'),
  ('lhc-venus', 'Mid-Sem Exam: PHY 5128', date '2026-09-24', time '15:00', time '17:00', 'Dr Sreedhar B Dutta', 'Mid Semester Examination. PHY 5128 / PHY 6128: 27 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: BIO 4126, CHY 324', date '2026-09-25', time '08:30', time '10:30', 'Dr Sabari Sankar Thirupathy; Dr Adithya Lakshmanna', 'Mid Semester Examination. BIO 4126 / BIO 6126: 13 students; CHY 324 / CHY 624: 43 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: MAT 313, BIO 4126', date '2026-09-25', time '08:30', time '10:30', 'Dr Jyothsna S; Dr Sabari Sankar Thirupathy', 'Mid Semester Examination. MAT 313 / MSM 404: 77 students; BIO 4126 / BIO 6126: 37 students'),
  ('lhc-venus', 'Mid-Sem Exam: CHY 5107', date '2026-09-25', time '08:30', time '10:30', 'Dr Vennapusa Sivaranjana Reddy, Prof R. S. Swathi, Dr Pushpita Ghosh', 'Mid Semester Examination. CHY 5107 / MSC 5107: 41 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: BIO 211', date '2026-09-25', time '11:30', time '13:30', 'Prof Hema Somanathan, Dr Nitin Uttam Kamble', 'Mid Semester Examination. BIO 211: 49 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: BIO 211', date '2026-09-25', time '11:30', time '13:30', 'Prof Hema Somanathan, Dr Nitin Uttam Kamble', 'Mid Semester Examination. BIO 211: 114 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: MAT 303, MAT 421', date '2026-09-25', time '15:00', time '17:00', 'Dr. Jayanta Sarkar; Dr K. R Arun', 'Mid Semester Examination. MAT 303 / MSM 401: 96 students; MAT 421 / MSM 512: 30 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: EES 321, HUM 412, CHY 5219', date '2026-09-25', time '15:00', time '17:00', 'Dr Rebekah S; Dr. Piyush Parimoo; Dr A Muthukrishnan', 'Mid Semester Examination. EES 321 / EES 6101: 14 students; HUM 412: 20 students; CHY 5219: 19 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: MAT 421, BIO 4026, MSC 403', date '2026-09-25', time '15:00', time '17:00', 'Dr K. R Arun; Dr Ravi Maruthachalam; Dr Soumen De', 'Mid Semester Examination. MAT 421 / MSM 512: 31 students; BIO 4026 / BIO 6026: 46 students; MSC 403: 27 students'),
  ('lhc-venus', 'Mid-Sem Exam: EES 321, PHY 5233', date '2026-09-25', time '15:00', time '17:00', 'Dr Rebekah S; Prof Joy Mitra', 'Mid Semester Examination. EES 321 / EES 6101: 10 students; PHY 5233 / PHY 6223: 13 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MSP 427', date '2026-09-26', time '08:30', time '10:30', 'Dr Bindusar Sahoo', 'Mid Semester Examination. MSP 427 / PHY 327: 56 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: AOE 3016', date '2026-09-26', time '08:30', time '10:30', 'Dr Sandhya Ganesan', 'Mid Semester Examination. AOE 3016 / BIO 416 / BIO 616 / MSB 502: 110 students'),
  ('lhc-venus', 'Mid-Sem Exam: MSP 427', date '2026-09-26', time '08:30', time '10:30', 'Dr Bindusar Sahoo', 'Mid Semester Examination. MSP 427 / PHY 327: 48 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MAT 201', date '2026-09-26', time '11:30', time '13:30', 'Dr Dond Asha Kisan', 'Mid Semester Examination. MAT 201: 53 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: MAT 201', date '2026-09-26', time '11:30', time '13:30', 'Dr Dond Asha Kisan', 'Mid Semester Examination. MAT 201: 114 students'),
  ('lhc-venus', 'Mid-Sem Exam: MAT 201', date '2026-09-26', time '11:30', time '13:30', 'Dr Dond Asha Kisan', 'Mid Semester Examination. MAT 201: 56 students'),
  ('lhc-bhaskara', 'Mid-Sem Exam: MSP 424, CHY 321', date '2026-09-26', time '15:00', time '17:00', 'Dr. Solingyur Zimik Kachui; Dr Ramaraj Ayyappan', 'Mid Semester Examination. MSP 424 / PHY 324: 101 students; CHY 321 / MSC 401: 25 students'),
  ('lhc-jupiter', 'Mid-Sem Exam: MAT 321, BIO 4111', date '2026-09-26', time '15:00', time '17:00', 'Prof Viji Z. Thomas; Dr Sabari Sankar Thirupathy', 'Mid Semester Examination. MAT 321 / MAT 3521 / MSM 403: 31 students; BIO 4111 / BIO 6111 / MSB 406: 25 students'),
  ('lhc-kaumudi', 'Mid-Sem Exam: CHY 321, MAT 321', date '2026-09-26', time '15:00', time '17:00', 'Dr Ramaraj Ayyappan; Prof Viji Z. Thomas', 'Mid Semester Examination. CHY 321 / MSC 401: 62 students; MAT 321 / MAT 3521 / MSM 403: 52 students'),
  ('lhc-venus', 'Mid-Sem Exam: BIO 4111', date '2026-09-26', time '15:00', time '17:00', 'Dr Sabari Sankar Thirupathy', 'Mid Semester Examination. BIO 4111 / BIO 6111 / MSB 406: 25 students')
) as v(room_id, title, event_date, start_time, end_time, professor, description);

commit;

-- Check: exam events per hall.
select r.name as hall, count(e.id) as exams
from public.rooms r left join public.events e on e.room_id = r.id and e.event_type = 'exam'
group by r.name order by r.name;
