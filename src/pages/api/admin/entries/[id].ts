export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { sendEmail } from '../../../../lib/resend';
import WelcomeEmail from '../../../../emails/WelcomeEmail';
import PaymentRejectedEmail from '../../../../emails/PaymentRejectedEmail';
import * as React from 'react';

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

    // 3. Enviar correo transaccional según el nuevo estado utilizando plantillas React Email
    if ((status === 'approved' || status === 'rejected') && userEmail) {
      const emailPromise = sendEmail({
        to: userEmail,
        subject: status === 'approved' 
          ? `Cupo Aprobado: ${entry.display_name} - Quiniela Mundial 2026`
          : `Problema con tu cupo: ${entry.display_name} - Quiniela Mundial 2026`,
        react: status === 'approved'
          ? React.createElement(WelcomeEmail, { userName: userFullName || 'Usuario', isPaymentApproved: true })
          : React.createElement(PaymentRejectedEmail, { userName: userFullName || 'Usuario', reason: rejectionReason }),
      }).catch(err => console.error(`Error asíncrono en sendEmail (${status}):`, err));

      const runtime = (locals as any).runtime;
      if (runtime?.context?.waitUntil) {
        runtime.context.waitUntil(emailPromise);
      } else {
        await emailPromise;
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  // Explicit admin check
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID de cupo no especificado' }), { status: 400 });
  }

  try {
    // 1. Obtener los datos del cupo para ver si tiene un comprobante asociado
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('entries')
      .select('payment_receipt_url')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      return new Response(JSON.stringify({ error: 'Cupo no encontrado' }), { status: 404 });
    }

    // 2. Si tiene comprobante, eliminarlo de Storage
    if (entry.payment_receipt_url) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('payment-receipts')
        .remove([entry.payment_receipt_url]);
      
      if (storageError) {
        console.error('Error al eliminar comprobante de Storage:', storageError);
      }
    }

    // 3. Eliminar el cupo de la base de datos (las predicciones se borrarán en cascada)
    const { error: deleteError } = await supabaseAdmin
      .from('entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
