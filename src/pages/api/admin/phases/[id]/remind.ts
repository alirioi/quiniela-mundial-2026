export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { resend } from '../../../../../lib/resend';
import PhaseReminderEmail from '../../../../../emails/PhaseReminderEmail';
import { render } from '@react-email/components';
import { resolveKnockoutTeamNames } from '../../../../../utils/matches';
import { requireAdmin } from '../../../../../utils/api-helpers';

export const POST: APIRoute = async ({ params, locals }) => {
  const adminError = requireAdmin(locals);
  if (adminError) return adminError;

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
      .select('id, match_time, status, home_team, away_team, match_number')
      .eq('phase_id', phaseId)
      .order('match_time', { ascending: true });

    // Reemplazar nombres si es necesario (para que el email muestre los equipos correctos si ya están definidos)
    if (matches && matches.length > 0) {
      await resolveKnockoutTeamNames(matches);
    }

    const nextMatch = matches?.find(m => m.status === 'scheduled');

    if (!nextMatch) {
      return new Response(JSON.stringify({ sentCount: 0, message: 'No hay partidos pendientes en esta fase' }), { status: 200 });
    }

    // 4. Obtener usuarios aprobados
    const { data: entries } = await supabaseAdmin
      .from('entries')
      .select(`
        id,
        user_id,
        status,
        predicted_champion,
        profiles:user_id (
          full_name,
          email,
          role
        )
      `)
      .eq('status', 'approved');

    if (!entries) {
       return new Response(JSON.stringify({ sentCount: 0 }), { status: 200 });
    }

    // Obtener predicciones solo para el próximo partido
    const { data: predictions } = await supabaseAdmin
      .from('predictions')
      .select('entry_id')
      .eq('match_id', nextMatch.id);

    if (!entries) {
       return new Response(JSON.stringify({ sentCount: 0 }), { status: 200 });
    }

    // 5. Determinar quiénes no han completado el SIGUIENTE partido
    const usersToRemind = new Map<string, { email: string, name: string, missingNextMatch: boolean }>();

    entries.forEach((entry: any) => {
      if (!entry.profiles || entry.profiles.role === 'admin') return;
      
      const email = entry.profiles.email;
      const name = entry.profiles.full_name;

      const hasNextMatchPrediction = predictions?.some(p => p.entry_id === entry.id);

      if (!hasNextMatchPrediction) {
        usersToRemind.set(email, {
          email,
          name,
          missingNextMatch: true
        });
      }
    });

    // 6. Enviar correos
    let sentCount = 0;
    const emailPromises = Array.from(usersToRemind.values()).map(async (user) => {
      try {
        const html = render(
          PhaseReminderEmail({
            userName: user.name,
            phaseName: phase.name,
            missingGold: false,
            missingFirstMatch: true // Reusing this prop for the email template for now
          })
        );
        
        // Let's replace the subject line for this logic
        const subject = `¡Te falta pronosticar el partido ${nextMatch.home_team} vs ${nextMatch.away_team}! ⏰`;

        await resend.emails.send({
          from: 'Quiniela Mundial 2026 <quiniela@alirioi.dev>',
          to: user.email,
          subject,
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
