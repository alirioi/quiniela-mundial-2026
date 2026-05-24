import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { sendEmail } from '../../../../lib/resend';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  // Explicit admin check
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de cupo no especificado' }), { status: 400 });
  }

  try {
    const { status, rejectionReason } = await request.json();

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Estado no válido' }), { status: 400 });
    }

    // 1. Obtener los datos del cupo y el correo del usuario antes de actualizar
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('entries')
      .select(`
        entry_number,
        display_name,
        user_id,
        profiles (
          full_name,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
    }

    const profile = (entry as any).profiles;
    const userEmail = profile?.email;
    const userFullName = profile?.full_name;

    // 2. Actualizar el estado del cupo en la base de datos
    const { error: updateError } = await supabaseAdmin
      .from('entries')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
    }

    // 3. Enviar correo transaccional según el nuevo estado
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://quiniela.alirioi.dev';
    
    if (status === 'approved' && userEmail) {
      // Enviar correo de aprobación
      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg;">
          <h2 style="color: #10b981; text-align: center;">¡Tu cupo ha sido aprobado!</h2>
          <p>Hola <strong>${userFullName}</strong>,</p>
          <p>Te informamos que tu comprobante de pago para el cupo <strong>"${entry.display_name}"</strong> (Cupo #${entry.entry_number}) ha sido verificado con éxito.</p>
          <p>Ya puedes acceder a la plataforma para completar tus predicciones de la Fase de Grupos.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px;">Ir a la Quiniela</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Quiniela Mundial 2026</p>
        </div>
      `;

      // Intentar enviar el correo de forma no bloqueante
      sendEmail({
        to: userEmail,
        subject: `Cupo Aprobado: ${entry.display_name} - Quiniela Mundial 2026`,
        html: htmlContent
      }).catch(err => console.error('Error asíncrono en sendEmail:', err));

    } else if (status === 'rejected' && userEmail) {
      // Enviar correo de rechazo
      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg;">
          <h2 style="color: #ef4444; text-align: center;">Problema con tu registro</h2>
          <p>Hola <strong>${userFullName}</strong>,</p>
          <p>Lamentamos informarte que tu comprobante de pago para el cupo <strong>"${entry.display_name}"</strong> no ha podido ser aprobado.</p>
          ${rejectionReason ? `<p><strong>Motivo especificado por el administrador:</strong></p>
          <blockquote style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 10px 15px; margin: 15px 0; color: #475569;">
            ${rejectionReason}
          </blockquote>` : ''}
          <p>Por favor, ponte en contacto con el organizador o inicia sesión de nuevo para cargar un comprobante válido.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px;">Verificar mi cuenta</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Quiniela Mundial 2026</p>
        </div>
      `;

      sendEmail({
        to: userEmail,
        subject: `Problema con tu cupo: ${entry.display_name} - Quiniela Mundial 2026`,
        html: htmlContent
      }).catch(err => console.error('Error asíncrono en sendEmail:', err));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
