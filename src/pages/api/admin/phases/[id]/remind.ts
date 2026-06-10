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

    // 3. Obtener el primer partido del mundial (el de fecha más antigua)
    const { data: firstMatch } = await supabaseAdmin
      .from('matches')
      .select('id')
      .order('match_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    const firstMatchId = firstMatch?.id;

    // 4. Obtener usuarios aprobados y sus predicciones (incluyendo Pronóstico de Oro)
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
        ),
        predictions (
          match_id
        )
      `)
      .eq('status', 'approved');

    if (!entries) {
       return new Response(JSON.stringify({ sentCount: 0 }), { status: 200 });
    }

    // 5. Determinar quiénes no han completado
    const usersToRemind = new Map<string, { email: string, name: string, missingGold: boolean, missingFirstMatch: boolean }>();

    entries.forEach((entry: any) => {
      if (!entry.profiles || entry.profiles.role === 'admin') return;
      
      const email = entry.profiles.email;
      const name = entry.profiles.full_name;

      const hasGoldPrediction = !!entry.predicted_champion;
      const hasFirstMatchPrediction = firstMatchId
        ? entry.predictions.some((p: any) => p.match_id === firstMatchId)
        : true;

      // Si le falta el pronóstico de oro OR el pronóstico del primer partido, le notificamos
      if (!hasGoldPrediction || !hasFirstMatchPrediction) {
        const missingGold = !hasGoldPrediction;
        const missingFirstMatch = !hasFirstMatchPrediction;
        
        const existing = usersToRemind.get(email);
        if (existing) {
          existing.missingGold = existing.missingGold || missingGold;
          existing.missingFirstMatch = existing.missingFirstMatch || missingFirstMatch;
        } else {
          usersToRemind.set(email, {
            email,
            name,
            missingGold,
            missingFirstMatch
          });
        }
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
            missingGold: user.missingGold,
            missingFirstMatch: user.missingFirstMatch
          })
        );
        
        const subject = user.missingGold && user.missingFirstMatch
          ? '¡Te falta tu Pronóstico de Oro y tu primer partido! ⏰'
          : user.missingGold
          ? '¡Te falta llenar tu Pronóstico de Oro! 🏆'
          : '¡Te falta pronosticar el primer partido del Mundial! ⚽';

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
