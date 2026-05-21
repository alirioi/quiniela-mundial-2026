-- Seed Data Actualizado con Sorteo Oficial de FIFA del 5 de Diciembre de 2025
-- Reemplaza los marcadores de posición A2, A3, B2, etc., con los equipos oficiales correspondientes.

-- 1. Insertar Fase de Grupos
INSERT INTO tournament_phases (id, name, slug, "order", is_active)
VALUES (1, 'Fase de Grupos', 'grupos', 1, true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, slug = EXCLUDED.slug, "order" = EXCLUDED."order", is_active = EXCLUDED.is_active;

-- 2. Insertar partidos de la Fase de Grupos oficiales
-- Mapeo del sorteo de FIFA:
-- Grupo A: México, Sudáfrica, Corea del Sur, Chequia
-- Grupo B: Canadá, Bosnia y Herzegovina, Qatar, Suiza
-- Grupo C: Brasil, Marruecos, Haití, Escocia
-- Grupo D: Estados Unidos, Paraguay, Australia, Turquía
-- Grupo E: Alemania, Curazao, Costa de Marfil, Ecuador
-- Grupo F: Países Bajos, Japón, Suecia, Túnez
-- Grupo G: Bélgica, Egipto, Irán, Nueva Zelanda
-- Grupo H: España, Cabo Verde, Arabia Saudita, Uruguay
-- Grupo I: Francia, Senegal, Irak, Noruega
-- Grupo J: Argentina, Argelia, Austria, Jordania
-- Grupo K: Portugal, RD Congo, Uzbekistán, Colombia
-- Grupo L: Inglaterra, Croacia, Ghana, Panamá

INSERT INTO matches (id, phase_id, home_team, away_team, match_time, group_name, match_number, status)
VALUES
  -- GRUPO A: México (A1), Sudáfrica (A2), Corea del Sur (A3), Chequia (A4)
  (1, 1, 'México', 'Sudáfrica', '2026-06-11 22:30:00+00', 'Grupo A', 1, 'scheduled'),
  (2, 1, 'Corea del Sur', 'Chequia', '2026-06-12 15:00:00+00', 'Grupo A', 4, 'scheduled'),
  (3, 1, 'México', 'Corea del Sur', '2026-06-18 20:00:00+00', 'Grupo A', 25, 'scheduled'),
  (4, 1, 'Chequia', 'Sudáfrica', '2026-06-18 23:00:00+00', 'Grupo A', 28, 'scheduled'),
  (5, 1, 'Chequia', 'México', '2026-06-24 21:00:00+00', 'Grupo A', 53, 'scheduled'),
  (6, 1, 'Sudáfrica', 'Corea del Sur', '2026-06-24 21:00:00+00', 'Grupo A', 54, 'scheduled'),

  -- GRUPO B: Canadá (B1), Bosnia y Herzegovina (B2), Qatar (B3), Suiza (B4)
  (7, 1, 'Canadá', 'Bosnia y Herzegovina', '2026-06-12 21:00:00+00', 'Grupo B', 3, 'scheduled'),
  (8, 1, 'Qatar', 'Suiza', '2026-06-13 18:00:00+00', 'Grupo B', 8, 'scheduled'),
  (9, 1, 'Canadá', 'Qatar', '2026-06-19 20:00:00+00', 'Grupo B', 31, 'scheduled'),
  (10, 1, 'Suiza', 'Bosnia y Herzegovina', '2026-06-19 17:00:00+00', 'Grupo B', 32, 'scheduled'),
  (11, 1, 'Suiza', 'Canadá', '2026-06-25 21:00:00+00', 'Grupo B', 59, 'scheduled'),
  (12, 1, 'Bosnia y Herzegovina', 'Qatar', '2026-06-25 21:00:00+00', 'Grupo B', 60, 'scheduled'),

  -- GRUPO C: Brasil (C1), Marruecos (C2), Haití (C3), Escocia (C4)
  (13, 1, 'Brasil', 'Marruecos', '2026-06-13 15:00:00+00', 'Grupo C', 5, 'scheduled'),
  (14, 1, 'Haití', 'Escocia', '2026-06-13 21:00:00+00', 'Grupo C', 7, 'scheduled'),
  (15, 1, 'Brasil', 'Haití', '2026-06-19 23:00:00+00', 'Grupo C', 29, 'scheduled'),
  (16, 1, 'Escocia', 'Marruecos', '2026-06-20 18:00:00+00', 'Grupo C', 36, 'scheduled'),
  (17, 1, 'Escocia', 'Brasil', '2026-06-24 18:00:00+00', 'Grupo C', 49, 'scheduled'),
  (18, 1, 'Marruecos', 'Haití', '2026-06-24 18:00:00+00', 'Grupo C', 50, 'scheduled'),

  -- GRUPO D: Estados Unidos (D1), Paraguay (D2), Australia (D3), Turquía (D4)
  (19, 1, 'Estados Unidos', 'Paraguay', '2026-06-12 18:00:00+00', 'Grupo D', 2, 'scheduled'),
  (20, 1, 'Australia', 'Turquía', '2026-06-13 23:00:00+00', 'Grupo D', 6, 'scheduled'),
  (21, 1, 'Estados Unidos', 'Australia', '2026-06-18 17:00:00+00', 'Grupo D', 26, 'scheduled'),
  (22, 1, 'Turquía', 'Paraguay', '2026-06-18 20:00:00+00', 'Grupo D', 27, 'scheduled'),
  (23, 1, 'Turquía', 'Estados Unidos', '2026-06-25 18:00:00+00', 'Grupo D', 57, 'scheduled'),
  (24, 1, 'Paraguay', 'Australia', '2026-06-25 18:00:00+00', 'Grupo D', 58, 'scheduled'),

  -- GRUPO E: Alemania (E1), Curazao (E2), Costa de Marfil (E3), Ecuador (E4)
  (25, 1, 'Alemania', 'Curazao', '2026-06-14 18:00:00+00', 'Grupo E', 9, 'scheduled'),
  (26, 1, 'Costa de Marfil', 'Ecuador', '2026-06-14 21:00:00+00', 'Grupo E', 10, 'scheduled'),
  (27, 1, 'Alemania', 'Costa de Marfil', '2026-06-20 21:00:00+00', 'Grupo E', 33, 'scheduled'),
  (28, 1, 'Ecuador', 'Curazao', '2026-06-20 23:00:00+00', 'Grupo E', 34, 'scheduled'),
  (29, 1, 'Ecuador', 'Alemania', '2026-06-25 15:00:00+00', 'Grupo E', 55, 'scheduled'),
  (30, 1, 'Curazao', 'Costa de Marfil', '2026-06-25 15:00:00+00', 'Grupo E', 56, 'scheduled'),

  -- GRUPO F: Países Bajos (F1), Japón (F2), Suecia (F3), Túnez (F4)
  (31, 1, 'Países Bajos', 'Japón', '2026-06-14 15:00:00+00', 'Grupo F', 11, 'scheduled'),
  (32, 1, 'Suecia', 'Túnez', '2026-06-14 23:00:00+00', 'Grupo F', 12, 'scheduled'),
  (33, 1, 'Países Bajos', 'Suecia', '2026-06-20 15:00:00+00', 'Grupo F', 35, 'scheduled'),
  (34, 1, 'Túnez', 'Japón', '2026-06-21 21:00:00+00', 'Grupo F', 38, 'scheduled'),
  (35, 1, 'Túnez', 'Países Bajos', '2026-06-26 18:00:00+00', 'Grupo F', 65, 'scheduled'),
  (36, 1, 'Japón', 'Suecia', '2026-06-26 18:00:00+00', 'Grupo F', 66, 'scheduled'),

  -- GRUPO G: Bélgica (G1), Egipto (G2), Irán (G3), Nueva Zelanda (G4)
  (37, 1, 'Bélgica', 'Egipto', '2026-06-15 15:00:00+00', 'Grupo G', 13, 'scheduled'),
  (38, 1, 'Irán', 'Nueva Zelanda', '2026-06-15 18:00:00+00', 'Grupo G', 14, 'scheduled'),
  (39, 1, 'Bélgica', 'Irán', '2026-06-21 15:00:00+00', 'Grupo G', 39, 'scheduled'),
  (40, 1, 'Nueva Zelanda', 'Egipto', '2026-06-21 18:00:00+00', 'Grupo G', 40, 'scheduled'),
  (41, 1, 'Nueva Zelanda', 'Bélgica', '2026-06-26 15:00:00+00', 'Grupo G', 61, 'scheduled'),
  (42, 1, 'Egipto', 'Irán', '2026-06-26 15:00:00+00', 'Grupo G', 62, 'scheduled'),

  -- GRUPO H: España (H1), Cabo Verde (H2), Arabia Saudita (H3), Uruguay (H4)
  (43, 1, 'España', 'Cabo Verde', '2026-06-15 21:00:00+00', 'Grupo H', 15, 'scheduled'),
  (44, 1, 'Arabia Saudita', 'Uruguay', '2026-06-15 23:00:00+00', 'Grupo H', 16, 'scheduled'),
  (45, 1, 'España', 'Arabia Saudita', '2026-06-22 18:00:00+00', 'Grupo H', 41, 'scheduled'),
  (46, 1, 'Uruguay', 'Cabo Verde', '2026-06-22 21:00:00+00', 'Grupo H', 42, 'scheduled'),
  (47, 1, 'Uruguay', 'España', '2026-06-26 21:00:00+00', 'Grupo H', 69, 'scheduled'),
  (48, 1, 'Cabo Verde', 'Arabia Saudita', '2026-06-26 21:00:00+00', 'Grupo H', 70, 'scheduled'),

  -- GRUPO I: Francia (I1), Senegal (I2), Irak (I3), Noruega (I4)
  (49, 1, 'Francia', 'Senegal', '2026-06-16 15:00:00+00', 'Grupo I', 17, 'scheduled'),
  (50, 1, 'Irak', 'Noruega', '2026-06-16 18:00:00+00', 'Grupo I', 18, 'scheduled'),
  (51, 1, 'Francia', 'Irak', '2026-06-22 15:00:00+00', 'Grupo I', 43, 'scheduled'),
  (52, 1, 'Noruega', 'Senegal', '2026-06-22 23:00:00+00', 'Grupo I', 44, 'scheduled'),
  (53, 1, 'Noruega', 'Francia', '2026-06-26 21:00:00+00', 'Grupo I', 71, 'scheduled'),
  (54, 1, 'Senegal', 'Irak', '2026-06-26 21:00:00+00', 'Grupo I', 72, 'scheduled'),

  -- GRUPO J: Argentina (J1), Argelia (J2), Austria (J3), Jordania (J4)
  (55, 1, 'Argentina', 'Argelia', '2026-06-16 21:00:00+00', 'Grupo J', 19, 'scheduled'),
  (56, 1, 'Austria', 'Jordania', '2026-06-16 23:00:00+00', 'Grupo J', 20, 'scheduled'),
  (57, 1, 'Argentina', 'Austria', '2026-06-23 18:00:00+00', 'Grupo J', 45, 'scheduled'),
  (58, 1, 'Jordania', 'Argelia', '2026-06-23 21:00:00+00', 'Grupo J', 46, 'scheduled'),
  (59, 1, 'Jordania', 'Argentina', '2026-06-27 15:00:00+00', 'Grupo J', 63, 'scheduled'),
  (60, 1, 'Argelia', 'Austria', '2026-06-27 15:00:00+00', 'Grupo J', 64, 'scheduled'),

  -- GRUPO K: Portugal (K1), RD Congo (K2), Uzbekistán (K3), Colombia (K4)
  (61, 1, 'Portugal', 'RD Congo', '2026-06-17 15:00:00+00', 'Grupo K', 21, 'scheduled'),
  (62, 1, 'Uzbekistán', 'Colombia', '2026-06-17 18:00:00+00', 'Grupo K', 22, 'scheduled'),
  (63, 1, 'Portugal', 'Uzbekistán', '2026-06-23 15:00:00+00', 'Grupo K', 47, 'scheduled'),
  (64, 1, 'Colombia', 'RD Congo', '2026-06-23 23:00:00+00', 'Grupo K', 48, 'scheduled'),
  (65, 1, 'Colombia', 'Portugal', '2026-06-27 18:00:00+00', 'Grupo K', 67, 'scheduled'),
  (66, 1, 'RD Congo', 'Uzbekistán', '2026-06-27 18:00:00+00', 'Grupo K', 68, 'scheduled'),

  -- GRUPO L: Inglaterra (L1), Croacia (L2), Ghana (L3), Panamá (L4)
  (67, 1, 'Inglaterra', 'Croacia', '2026-06-17 21:00:00+00', 'Grupo L', 23, 'scheduled'),
  (68, 1, 'Ghana', 'Panamá', '2026-06-17 23:00:00+00', 'Grupo L', 24, 'scheduled'),
  (69, 1, 'Inglaterra', 'Ghana', '2026-06-24 15:00:00+00', 'Grupo L', 51, 'scheduled'),
  (70, 1, 'Panamá', 'Croacia', '2026-06-24 18:00:00+00', 'Grupo L', 52, 'scheduled'),
  (71, 1, 'Panamá', 'Inglaterra', '2026-06-27 21:00:00+00', 'Grupo L', 73, 'scheduled'),
  (72, 1, 'Croacia', 'Ghana', '2026-06-27 21:00:00+00', 'Grupo L', 74, 'scheduled')
ON CONFLICT (id) DO UPDATE 
SET phase_id = EXCLUDED.phase_id,
    home_team = EXCLUDED.home_team,
    away_team = EXCLUDED.away_team,
    match_time = EXCLUDED.match_time,
    group_name = EXCLUDED.group_name,
    match_number = EXCLUDED.match_number,
    status = EXCLUDED.status;
