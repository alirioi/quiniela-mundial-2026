export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { resend } from '../../../../../lib/resend';
import PhaseReminderEmail from '../../../../../emails/PhaseReminderEmail';
import { render } from '@react-email/components';

export const POST: APIRoute = async ({ params, locals }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const phaseId = parseInt(params.id!);
  if (isNaN(phaseId)) {
    return new Response(JSON.stringify({ error: 'ID de fase inválido' }), { status: 400 });
  }

  try {
    // 1. Obtener info de la fase
    const { data: phase } = await supabaseAdmin
      .from('tournament_phases')
      .select('name')
      .eq('id', phaseId)
      .single();

    if (!phase) {
      return new Response(JSON.stringify({ error: 'Fase no encontrada' }), { status: 404 });
    }

    // 2. Obtener partidos de la fase
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('phase_id', phaseId);

    const matchIds = matches?.map(m => m.id) || [];
    const totalMatches = matchIds.length;

    if (totalMatches === 0) {
      return new Response(JSON.stringify({ sentCount: 0 }), { status: 200 });
    }

    // 3. Obtener usuarios aprobados y sus predicciones
    const { data: entries } = await supabaseAdmin
      .from('entries')
      .select(`
        id,
        user_id,
        status,
        profiles:user_id (
          full_name,
          email
        ),
        predictions (
          match_id
        )
      `)
      .eq('status', 'approved');

    if (!entries) {
       return new Response(JSON.stringify({ sentCount: 0 }), { status: 200 });
    }

    // 4. Determinar quiénes no han completado
    const usersToRemind = new Map<string, { email: string, name: string }>();

    entries.forEach((entry: any) => {
      if (!entry.profiles) return;
      
      const email = entry.profiles.email;
      const name = entry.profiles.full_name;

      if (usersToRemind.has(email)) return;

      const userPredictionsForPhase = entry.predictions.filter((p: any) => matchIds.includes(p.match_id));
      
      if (userPredictionsForPhase.length < totalMatches) {
        usersToRemind.set(email, { email, name });
      }
    });

    // 5. Enviar correos
    let sentCount = 0;
    const emailPromises = Array.from(usersToRemind.values()).map(async (user) => {
      try {
        const html = render(PhaseReminderEmail({ userName: user.name, phaseName: phase.name }));
        await resend.emails.send({
          from: 'Quiniela Mundial 2026 <quiniela@alirioi.dev>',
          to: user.email,
          subject: `Faltan pronósticos para la ${phase.name} ⏰`,
          html,
        });
        sentCount++;
      } catch (err) {
        console.error(`Error enviando correo a ${user.email}:`, err);
      }
    });

    await Promise.all(emailPromises);

    return new Response(JSON.stringify({ sentCount }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
