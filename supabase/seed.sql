-- Seed Data para Quiniela Mundial 2026
-- Inserción de la Fase de Grupos y los 72 partidos oficiales

-- 1. Insertar Fase de Grupos
INSERT INTO tournament_phases (id, name, slug, "order", is_active)
VALUES (1, 'Fase de Grupos', 'grupos', 1, true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, slug = EXCLUDED.slug, "order" = EXCLUDED."order", is_active = EXCLUDED.is_active;

-- 2. Insertar partidos de la Fase de Grupos (72 partidos del calendario oficial de FIFA)
-- Las horas están guardadas en UTC de acuerdo al fixture oficial de sedes de FIFA 2026
INSERT INTO matches (id, phase_id, home_team, away_team, match_time, group_name, match_number, status)
VALUES
  -- GRUPO A
  (1, 1, 'México', 'A2', '2026-06-11 22:30:00+00', 'Grupo A', 1, 'scheduled'),
  (2, 1, 'A3', 'A4', '2026-06-12 15:00:00+00', 'Grupo A', 4, 'scheduled'),
  (3, 1, 'México', 'A3', '2026-06-18 20:00:00+00', 'Grupo A', 25, 'scheduled'),
  (4, 1, 'A4', 'A2', '2026-06-18 23:00:00+00', 'Grupo A', 28, 'scheduled'),
  (5, 1, 'A4', 'México', '2026-06-24 21:00:00+00', 'Grupo A', 53, 'scheduled'),
  (6, 1, 'A2', 'A3', '2026-06-24 21:00:00+00', 'Grupo A', 54, 'scheduled'),

  -- GRUPO B
  (7, 1, 'Estados Unidos', 'B2', '2026-06-12 21:00:00+00', 'Grupo B', 3, 'scheduled'),
  (8, 1, 'B3', 'B4', '2026-06-13 18:00:00+00', 'Grupo B', 8, 'scheduled'),
  (9, 1, 'Estados Unidos', 'B3', '2026-06-19 20:00:00+00', 'Grupo B', 31, 'scheduled'),
  (10, 1, 'B4', 'B2', '2026-06-19 17:00:00+00', 'Grupo B', 32, 'scheduled'),
  (11, 1, 'B4', 'Estados Unidos', '2026-06-25 21:00:00+00', 'Grupo B', 59, 'scheduled'),
  (12, 1, 'B2', 'B3', '2026-06-25 21:00:00+00', 'Grupo B', 60, 'scheduled'),

  -- GRUPO C
  (13, 1, 'C1', 'C2', '2026-06-13 15:00:00+00', 'Grupo C', 5, 'scheduled'),
  (14, 1, 'C3', 'C4', '2026-06-13 21:00:00+00', 'Grupo C', 7, 'scheduled'),
  (15, 1, 'C1', 'C3', '2026-06-19 23:00:00+00', 'Grupo C', 29, 'scheduled'),
  (16, 1, 'C4', 'C2', '2026-06-20 18:00:00+00', 'Grupo C', 36, 'scheduled'),
  (17, 1, 'C4', 'C1', '2026-06-24 18:00:00+00', 'Grupo C', 49, 'scheduled'),
  (18, 1, 'C2', 'C3', '2026-06-24 18:00:00+00', 'Grupo C', 50, 'scheduled'),

  -- GRUPO D
  (19, 1, 'Canadá', 'D2', '2026-06-12 18:00:00+00', 'Grupo D', 2, 'scheduled'),
  (20, 1, 'D3', 'D4', '2026-06-13 23:00:00+00', 'Grupo D', 6, 'scheduled'),
  (21, 1, 'Canadá', 'D3', '2026-06-18 17:00:00+00', 'Grupo D', 26, 'scheduled'),
  (22, 1, 'D4', 'D2', '2026-06-18 20:00:00+00', 'Grupo D', 27, 'scheduled'),
  (23, 1, 'D4', 'Canadá', '2026-06-25 18:00:00+00', 'Grupo D', 57, 'scheduled'),
  (24, 1, 'D2', 'D3', '2026-06-25 18:00:00+00', 'Grupo D', 58, 'scheduled'),

  -- GRUPO E
  (25, 1, 'E1', 'E2', '2026-06-14 18:00:00+00', 'Grupo E', 9, 'scheduled'),
  (26, 1, 'E3', 'E4', '2026-06-14 21:00:00+00', 'Grupo E', 10, 'scheduled'),
  (27, 1, 'E1', 'E3', '2026-06-20 21:00:00+00', 'Grupo E', 33, 'scheduled'),
  (28, 1, 'E4', 'E2', '2026-06-20 23:00:00+00', 'Grupo E', 34, 'scheduled'),
  (29, 1, 'E4', 'E1', '2026-06-25 15:00:00+00', 'Grupo E', 55, 'scheduled'),
  (30, 1, 'E2', 'E3', '2026-06-25 15:00:00+00', 'Grupo E', 56, 'scheduled'),

  -- GRUPO F
  (31, 1, 'F1', 'F2', '2026-06-14 15:00:00+00', 'Grupo F', 11, 'scheduled'),
  (32, 1, 'F3', 'F4', '2026-06-14 23:00:00+00', 'Grupo F', 12, 'scheduled'),
  (33, 1, 'F1', 'F3', '2026-06-20 15:00:00+00', 'Grupo F', 35, 'scheduled'),
  (34, 1, 'F4', 'F2', '2026-06-21 21:00:00+00', 'Grupo F', 38, 'scheduled'),
  (35, 1, 'F4', 'F1', '2026-06-26 18:00:00+00', 'Grupo F', 65, 'scheduled'),
  (36, 1, 'F2', 'F3', '2026-06-26 18:00:00+00', 'Grupo F', 66, 'scheduled'),

  -- GRUPO G
  (37, 1, 'G1', 'G2', '2026-06-15 15:00:00+00', 'Grupo G', 13, 'scheduled'),
  (38, 1, 'G3', 'G4', '2026-06-15 18:00:00+00', 'Grupo G', 14, 'scheduled'),
  (39, 1, 'G1', 'G3', '2026-06-21 15:00:00+00', 'Grupo G', 39, 'scheduled'),
  (40, 1, 'G4', 'G2', '2026-06-21 18:00:00+00', 'Grupo G', 40, 'scheduled'),
  (41, 1, 'G4', 'G1', '2026-06-26 15:00:00+00', 'Grupo G', 61, 'scheduled'),
  (42, 1, 'G2', 'G3', '2026-06-26 15:00:00+00', 'Grupo G', 62, 'scheduled'),

  -- GRUPO H
  (43, 1, 'H1', 'H2', '2026-06-15 21:00:00+00', 'Grupo H', 15, 'scheduled'),
  (44, 1, 'H3', 'H4', '2026-06-15 23:00:00+00', 'Grupo H', 16, 'scheduled'),
  (45, 1, 'H1', 'H3', '2026-06-22 18:00:00+00', 'Grupo H', 41, 'scheduled'),
  (46, 1, 'H4', 'H2', '2026-06-22 21:00:00+00', 'Grupo H', 42, 'scheduled'),
  (47, 1, 'H4', 'H1', '2026-06-26 21:00:00+00', 'Grupo H', 69, 'scheduled'),
  (48, 1, 'H2', 'H3', '2026-06-26 21:00:00+00', 'Grupo H', 70, 'scheduled'),

  -- GRUPO I
  (49, 1, 'I1', 'I2', '2026-06-16 15:00:00+00', 'Grupo I', 17, 'scheduled'),
  (50, 1, 'I3', 'I4', '2026-06-16 18:00:00+00', 'Grupo I', 18, 'scheduled'),
  (51, 1, 'I1', 'I3', '2026-06-22 15:00:00+00', 'Grupo I', 43, 'scheduled'),
  (52, 1, 'I4', 'I2', '2026-06-22 23:00:00+00', 'Grupo I', 44, 'scheduled'),
  (53, 1, 'I4', 'I1', '2026-06-26 21:00:00+00', 'Grupo I', 71, 'scheduled'),
  (54, 1, 'I2', 'I3', '2026-06-26 21:00:00+00', 'Grupo I', 72, 'scheduled'),

  -- GRUPO J
  (55, 1, 'J1', 'J2', '2026-06-16 21:00:00+00', 'Grupo J', 19, 'scheduled'),
  (56, 1, 'J3', 'J4', '2026-06-16 23:00:00+00', 'Grupo J', 20, 'scheduled'),
  (57, 1, 'J1', 'J3', '2026-06-23 18:00:00+00', 'Grupo J', 45, 'scheduled'),
  (58, 1, 'J4', 'J2', '2026-06-23 21:00:00+00', 'Grupo J', 46, 'scheduled'),
  (59, 1, 'J4', 'J1', '2026-06-27 15:00:00+00', 'Grupo J', 63, 'scheduled'),
  (60, 1, 'J2', 'J3', '2026-06-27 15:00:00+00', 'Grupo J', 64, 'scheduled'),

  -- GRUPO K
  (61, 1, 'K1', 'K2', '2026-06-17 15:00:00+00', 'Grupo K', 21, 'scheduled'),
  (62, 1, 'K3', 'K4', '2026-06-17 18:00:00+00', 'Grupo K', 22, 'scheduled'),
  (63, 1, 'K1', 'K3', '2026-06-23 15:00:00+00', 'Grupo K', 47, 'scheduled'),
  (64, 1, 'K4', 'K2', '2026-06-23 23:00:00+00', 'Grupo K', 48, 'scheduled'),
  (65, 1, 'K4', 'K1', '2026-06-27 18:00:00+00', 'Grupo K', 67, 'scheduled'),
  (66, 1, 'K2', 'K3', '2026-06-27 18:00:00+00', 'Grupo K', 68, 'scheduled'),

  -- GRUPO L
  (67, 1, 'L1', 'L2', '2026-06-17 21:00:00+00', 'Grupo L', 23, 'scheduled'),
  (68, 1, 'L3', 'L4', '2026-06-17 23:00:00+00', 'Grupo L', 24, 'scheduled'),
  (69, 1, 'L1', 'L3', '2026-06-24 15:00:00+00', 'Grupo L', 51, 'scheduled'),
  (70, 1, 'L4', 'L2', '2026-06-24 18:00:00+00', 'Grupo L', 52, 'scheduled'),
  (71, 1, 'L4', 'L1', '2026-06-27 21:00:00+00', 'Grupo L', 73, 'scheduled'),
  (72, 1, 'L2', 'L3', '2026-06-27 21:00:00+00', 'Grupo L', 74, 'scheduled')
ON CONFLICT (id) DO UPDATE 
SET phase_id = EXCLUDED.phase_id,
    home_team = EXCLUDED.home_team,
    away_team = EXCLUDED.away_team,
    match_time = EXCLUDED.match_time,
    group_name = EXCLUDED.group_name,
    match_number = EXCLUDED.match_number,
    status = EXCLUDED.status;
