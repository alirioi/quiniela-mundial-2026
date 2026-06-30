export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ request, locals }) => {
  // Explicit admin check for defense in depth (middleware already handles this)
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  try {
    // 1. Obtener total de partidos programados y primer partido
    const { count: totalMatches, error: matchesError } = await supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true });

    if (matchesError) {
      return new Response(JSON.stringify({ error: matchesError.message }), { status: 400 });
    }

    const { data: firstMatch } = await supabaseAdmin
      .from('matches')
      .select('id')
      .order('match_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    const firstMatchId = firstMatch?.id || null;

    // 2. Obtener perfiles de usuarios con sus entradas y predicciones asociadas
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        role,
        entries (
          id,
          entry_number,
          display_name,
          status,
          binance_pay_user,
          total_points,
          payment_receipt_url,
          created_at,
          predicted_champion,
          predicted_champion_goals,
          predicted_final_goals,
          predictions (
            match_id,
            predicted_home,
            predicted_away,
            points_earned,
            matches (
              home_team,
              away_team,
              home_score,
              away_score,
              match_time
            )
          )
        )
      `)
      .order('full_name', { ascending: true });

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), { status: 400 });
    }

    // Obtener todos los partidos para poder identificar cuáles faltan y calcular cuadros
    const { data: allMatches } = await supabaseAdmin
      .from('matches')
      .select('id, phase_id, home_team, away_team, match_time, home_score, away_score, status, group_name, match_number, penalty_winner')
      .order('match_time', { ascending: true });

    // Reemplazar nombres de equipos si están en llaves con los valores calculados reales
    const matchesMap = new Map();
    if (allMatches) {
      const { calculateGroupStandings, calculateKnockoutBracket, isPlaceholderName } = await import('../../../utils/knockout');
      const { groupStandings, thirdPlaces } = calculateGroupStandings(allMatches);
      const bracket = calculateKnockoutBracket(groupStandings, thirdPlaces, undefined, allMatches);
      
      const knockoutMatchesByNumber = new Map();
      [
        ...Object.values(bracket.r32),
        ...Object.values(bracket.r16),
        ...Object.values(bracket.qf),
        ...Object.values(bracket.sf),
        bracket.finalMatch,
        bracket.thirdPlaceMatch
      ].filter(Boolean).forEach(km => {
        knockoutMatchesByNumber.set(km.matchNumber, km);
      });

      allMatches.forEach(match => {
        const km = knockoutMatchesByNumber.get(match.match_number);
        if (km) {
          if (!isPlaceholderName(km.homeTeam)) match.home_team = km.homeTeam;
          if (!isPlaceholderName(km.awayTeam)) match.away_team = km.awayTeam;
        }
        matchesMap.set(match.id, { home: match.home_team, away: match.away_team });
      });
    }

    // Formatear datos para la visualización del administrador
    const formattedParticipants = await Promise.all(
      profiles.map(async (profile) => {
        const entries = await Promise.all(
          (profile.entries || []).map(async (entry: any) => {
            const predictions = (entry.predictions || []).map((pred: any) => {
              const realMatch = matchesMap.get(pred.match_id);
              return {
                match_id: pred.match_id,
                home_team: realMatch ? realMatch.home : (pred.matches?.home_team || 'N/A'),
                away_team: realMatch ? realMatch.away : (pred.matches?.away_team || 'N/A'),
                predicted_home: pred.predicted_home,
                predicted_away: pred.predicted_away,
                home_score: pred.matches?.home_score ?? null,
                away_score: pred.matches?.away_score ?? null,
                points_earned: pred.points_earned,
                match_time: pred.matches?.match_time || ''
              };
            });

            // Generar URL firmada para el comprobante de pago si existe
            let signedUrl = null;
            if (entry.payment_receipt_url) {
              try {
                const { data: signedData } = await supabaseAdmin.storage
                  .from('payment-receipts')
                  .createSignedUrl(entry.payment_receipt_url, 3600); // 1 hora
                signedUrl = signedData?.signedUrl || null;
              } catch (e) {
                console.error('Error al firmar comprobante:', e);
              }
            }

            return {
              id: entry.id,
              entry_number: entry.entry_number,
              display_name: entry.display_name,
              status: entry.status,
              binance_pay_user: entry.binance_pay_user,
              total_points: entry.total_points,
              payment_receipt_url: entry.payment_receipt_url,
              signedUrl,
              predictions_count: predictions.length,
              predictions,
              predicted_champion: entry.predicted_champion,
              predicted_champion_goals: entry.predicted_champion_goals,
              predicted_final_goals: entry.predicted_final_goals
            };
          })
        );

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone || 'N/A',
          role: profile.role,
          entries,
          total_entries_count: entries.length
        };
      })
    );

    return new Response(
      JSON.stringify({
        totalMatches: totalMatches || 0,
        firstMatchId,
        participants: formattedParticipants,
        allMatches: allMatches || []
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
