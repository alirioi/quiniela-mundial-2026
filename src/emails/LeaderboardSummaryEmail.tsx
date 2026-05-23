import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface LeaderboardSummaryEmailProps {
  userName: string;
  pointsEarnedToday: number;
  currentPosition: number;
  totalParticipants: number;
  top3: { name: string; points: number }[];
}

export default function LeaderboardSummaryEmail({
  userName = 'Usuario',
  pointsEarnedToday = 0,
  currentPosition = 0,
  totalParticipants = 0,
  top3 = []
}: LeaderboardSummaryEmailProps) {
  return (
    <Layout previewText={`¡Resumen de la Jornada! Has sumado ${pointsEarnedToday} puntos hoy.`}>
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        Resumen de la Jornada 📊
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      <Text className="text-gray-700 text-base">
        Los partidos del día han concluido. Aquí tienes un resumen de tu desempeño:
      </Text>

      <Section className="bg-gray-50 border border-gray-200 rounded-md p-4 my-4 flex">
        <Text className="text-gray-900 text-lg font-bold text-center m-0">
          Hoy sumaste: <span className="text-wc-green">{pointsEarnedToday} puntos</span>
        </Text>
        <Text className="text-gray-700 text-sm text-center mt-2 m-0">
          Tu posición actual: <strong>#{currentPosition}</strong> de {totalParticipants} participantes
        </Text>
      </Section>

      {top3 && top3.length > 0 && (
        <>
          <Heading className="text-xl font-bold text-gray-900 mt-6 mb-2">
            Top 3 General 🏆
          </Heading>
          <Section className="bg-white border border-gray-200 rounded-md p-4">
            {top3.map((player, index) => (
              <Text key={index} className="text-gray-800 text-base my-1">
                {index === 0 && '🥇 '}
                {index === 1 && '🥈 '}
                {index === 2 && '🥉 '}
                <strong>{player.name}</strong> - {player.points} pts
              </Text>
            ))}
          </Section>
        </>
      )}

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-blue text-white font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/leaderboard"
        >
          Ver tabla de posiciones completa
        </Button>
      </Section>
    </Layout>
  );
}
