/**
 * @file supabase-browser.ts
 * @description Configuración del cliente de Supabase para operaciones en el lado del cliente (navegador).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Cliente de Supabase para uso en el navegador.
 * Utiliza las variables de entorno públicas y respeta las políticas de seguridad (RLS).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
