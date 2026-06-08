export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { sendEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, locals }) => {
  // El middleware protege automáticamente esta ruta bajo /api/admin/*
  // Pero hacemos una verificación explícita para mayor seguridad
  const profile = locals.profile;
  if (!profile || profile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  try {
    // 1. Obtener todos los cupos aprobados y la información de los usuarios
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select(`
        id,
        display_name,
        profiles (
          full_name,
          email
        )
      `)
      .eq('status', 'approved');

    if (entriesError) {
      return new Response(JSON.stringify({ error: entriesError.message }), { status: 400 });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ message: 'No hay cupos aprobados para notificar.' }), { status: 200 });
    }

    // 2. Agrupar destinatarios por email para evitar correos duplicados por usuario
    const recipients = new Map<string, string>(); // email -> full_name
    entries.forEach((entry: any) => {
      const email = entry.profiles?.email;
      const name = entry.profiles?.full_name;
      if (email) {
        recipients.set(email, name || 'Participante');
      }
    });

    const approvedEntriesCount = entries.length;
    const totalPool = approvedEntriesCount * 15;
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://quiniela.alirioi.dev';

    let successCount = 0;
    let failureCount = 0;
    const errors: any[] = [];

    // 3. Enviar correos individualmente a cada participante
    for (const [email, fullName] of recipients.entries()) {
      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 6px 16px; background-color: #f0fdf4; border: 1px solid #d1fae5; border-radius: 9999px; color: #059669; font-size: 12px; font-weight: bold; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">Quiniela Oficial</div>
            <h2 style="color: #0f172a; margin-top: 10px; font-family: 'Outfit', sans-serif;">¡Inscripciones Cerradas!</h2>
            <p style="color: #64748b; font-size: 14px;">El camino al Mundial 2026 ha comenzado</p>
          </div>
          
          <p>Hola <strong>${fullName}</strong>,</p>
          
          <p>Te informamos que las inscripciones y compras de cupos adicionales para la <strong>Quiniela Mundial 2026</strong> han cerrado oficialmente de acuerdo al reglamento (24 horas antes del pitazo inicial).</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
            <span style="font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748b; letter-spacing: 0.05em;">Pote Oficial Confirmado</span>
            <div style="font-size: 32px; font-weight: 800; color: #10b981; margin: 8px 0; font-family: monospace;">
              ${totalPool.toLocaleString('es-ES')} USDT
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 0;">
              ¡El 100% de este pote acumulado se lo llevará el <strong>primer lugar (único ganador)</strong> al finalizar el torneo! (${approvedEntriesCount} cupos aprobados en total).
            </p>
          </div>

          <div style="margin: 24px 0; font-size: 14px; line-height: 1.5;">
            <h3 style="color: #0f172a; font-size: 16px; margin-bottom: 8px;">Recordatorios Importantes:</h3>
            <ul style="padding-left: 20px; margin: 0; color: #475569;">
              <li style="margin-bottom: 6px;"><strong>Bloqueo de Pronósticos:</strong> Las predicciones de cada partido se bloquean automáticamente <strong>2 horas antes</strong> de su hora programada de inicio. ¡No olvides llenar tus marcadores a tiempo!</li>
              <li style="margin-bottom: 6px;"><strong>Clasificación General:</strong> La tabla de posiciones y los apodos de todos los participantes se harán públicos una vez comience el primer partido.</li>
              <li style="margin-bottom: 6px;"><strong>Preguntas Frecuentes:</strong> Si tienes dudas sobre las reglas de desempate o cálculo de puntos, puedes visitar la sección de <a href="${siteUrl}/faq" style="color: #10b981; text-decoration: none; font-weight: 600;">Reglas y FAQ</a>.</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 32px 0 20px 0;">
            <a href="${siteUrl}/dashboard" style="background-color: #0f172a; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: inline-block;">
              Ir a mi Dashboard
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            Quiniela Mundial 2026 — Soporte operativo y plataforma.
          </p>
        </div>
      `;

      const result = await sendEmail({
        to: email,
        subject: `¡Inscripciones Cerradas y Pote Oficial Confirmado! - Quiniela Mundial 2026`,
        html: htmlContent
      });

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        errors.push({ email, error: result.error || result.warning });
      }
    }

    return new Response(JSON.stringify({
      message: 'Notificaciones procesadas',
      totalDestinatarios: recipients.size,
      exitosos: successCount,
      fallidos: failureCount,
      errores: errors
    }), { status: 200 });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor', details: e.message }), { status: 500 });
  }
};
