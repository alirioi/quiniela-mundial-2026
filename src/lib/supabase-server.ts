/**
 * @file supabase-server.ts
 * @description Configuración del cliente de Supabase para operaciones en el lado del servidor.
 * Proporciona un cliente administrativo con privilegios elevados y una función para crear
 * clientes de servidor con el contexto del usuario.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Cliente administrativo de Supabase que utiliza la Service Role Key.
 * Debe usarse exclusivamente en el servidor y con precaución, ya que bypassa las RLS (Row Level Security).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Crea un cliente de Supabase para el lado del servidor.
 * 
 * @param {string} [accessToken] - Token de acceso del usuario para autenticar las peticiones.
 * @returns Cliente de Supabase configurado para operaciones de servidor.
 */
export function createSupabaseServerClient(accessToken?: string) {
  const options = accessToken
    ? {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    : {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      };

  return createClient(supabaseUrl, supabaseAnonKey, options);
}
