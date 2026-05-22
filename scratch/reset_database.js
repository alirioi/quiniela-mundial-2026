import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Leer .env manualmente
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no encontrados en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ADMIN_USER_ID = '0bf51714-0bd6-4763-8e70-fe4ac7297c77';

async function reset() {
  console.log('=== INICIANDO RESTABLECIMIENTO DE BASE DE DATOS ===');

  try {
    // 1. Eliminar predicciones de prueba
    console.log('1. Eliminando predicciones de prueba...');
    const { error: predError } = await supabase
      .from('predictions')
      .delete()
      .neq('id', 0);
    
    if (predError) {
      console.error('Error al borrar predicciones:', predError.message);
    } else {
      console.log('✓ Predicciones eliminadas.');
    }

    // 2. Eliminar cupos (entries) de prueba
    console.log('2. Eliminando cupos (entries) de prueba...');
    const { error: entryError } = await supabase
      .from('entries')
      .delete()
      .neq('id', 0);

    if (entryError) {
      console.error('Error al borrar cupos:', entryError.message);
    } else {
      console.log('✓ Cupos (entries) eliminados.');
    }

    // 3. Limpiar almacenamiento de comprobantes (payment-receipts)
    console.log('3. Limpiando archivos del storage "payment-receipts"...');
    // Listar carpetas en el bucket
    const { data: files, error: listError } = await supabase.storage
      .from('payment-receipts')
      .list('', { limit: 100 });

    if (listError) {
      console.error('Error al listar archivos del storage:', listError.message);
    } else if (files && files.length > 0) {
      // Eliminar recursivamente cada carpeta/archivo (usualmente las carpetas son IDs de usuario)
      for (const item of files) {
        console.log(`Eliminando archivos en carpeta de usuario: ${item.name}`);
        // Listar archivos dentro de la carpeta
        const { data: subFiles, error: subListError } = await supabase.storage
          .from('payment-receipts')
          .list(item.name);
        
        if (subListError) {
          console.error(`Error al listar subarchivos de ${item.name}:`, subListError.message);
          continue;
        }

        if (subFiles && subFiles.length > 0) {
          const filesToRemove = subFiles.map(sf => `${item.name}/${sf.name}`);
          const { error: removeError } = await supabase.storage
            .from('payment-receipts')
            .remove(filesToRemove);
          
          if (removeError) {
            console.error(`Error al eliminar archivos de ${item.name}:`, removeError.message);
          } else {
            console.log(`✓ Archivos de ${item.name} eliminados.`);
          }
        }
      }
      console.log('✓ Storage limpio.');
    } else {
      console.log('✓ El storage ya estaba vacío.');
    }

    // 4. Eliminar usuarios de prueba de Auth y Profiles (excepto el administrador)
    console.log('4. Eliminando usuarios de prueba (excepto administrador)...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error al listar usuarios de Auth:', usersError.message);
    } else if (usersData && usersData.users) {
      const usersToDelete = usersData.users.filter(u => u.id !== ADMIN_USER_ID);
      for (const u of usersToDelete) {
        console.log(`Eliminando usuario: ${u.email} (${u.id})`);
        const { error: delError } = await supabase.auth.admin.deleteUser(u.id);
        if (delError) {
          console.error(`Error al eliminar usuario ${u.email}:`, delError.message);
        } else {
          console.log(`✓ Usuario ${u.email} eliminado de Auth.`);
        }
      }
    }

    // Limpiar perfiles huérfanos que puedan haber quedado
    const { error: profError } = await supabase
      .from('profiles')
      .delete()
      .neq('id', ADMIN_USER_ID);

    if (profError) {
      console.error('Error al borrar perfiles huérfanos:', profError.message);
    } else {
      console.log('✓ Perfiles huérfanos eliminados.');
    }

    // 5. Restablecer partidos al fixture original de seed.sql
    console.log('5. Restableciendo partidos al fixture oficial...');
    const seedPath = path.join('supabase', 'seed.sql');
    if (!fs.existsSync(seedPath)) {
      console.error(`Error: No se encontró el archivo de semilla en ${seedPath}`);
      process.exit(1);
    }

    const seedSql = fs.readFileSync(seedPath, 'utf-8');
    
    // Usar regex para extraer los valores de los matches
    // Ejemplo de línea: (1, 1, 'México', 'Sudáfrica', '2026-06-11 22:30:00+00', 'Grupo A', 1, 'scheduled'),
    const matchRegex = /\(\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*'([^']+)'\s*\)/g;
    
    const matches = [];
    let match;
    while ((match = matchRegex.exec(seedSql)) !== null) {
      matches.push({
        id: parseInt(match[1]),
        phase_id: parseInt(match[2]),
        home_team: match[3],
        away_team: match[4],
        match_time: match[5],
        group_name: match[6],
        match_number: parseInt(match[7]),
        status: match[8],
        home_score: null,
        away_score: null
      });
    }

    if (matches.length === 0) {
      console.error('Error: No se pudieron extraer los partidos del archivo seed.sql');
    } else {
      console.log(`Se extrajeron ${matches.length} partidos del seed.sql. Realizando upsert...`);
      
      // Hacemos el upsert en lotes para evitar problemas de tamaño de payload
      const batchSize = 20;
      for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from('matches')
          .upsert(batch, { onConflict: 'id' });
        
        if (upsertError) {
          console.error(`Error al realizar upsert en lote ${i / batchSize + 1}:`, upsertError.message);
          throw upsertError;
        }
      }
      console.log('✓ Partidos restablecidos correctamente al fixture oficial.');
    }

    console.log('=== RESTABLECIMIENTO COMPLETADO CON ÉXITO ===');
  } catch (err) {
    console.error('Ocurrió un error general durante el restablecimiento:', err);
    process.exit(1);
  }
}

reset();
