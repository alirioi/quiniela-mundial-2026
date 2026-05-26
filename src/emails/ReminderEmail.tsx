import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface ReminderEmailProps {
  userName: string;
  type: 'empty_predictions' | 'world_cup_start';
}

export default function ReminderEmail({ userName = 'Usuario', type = 'empty_predictions' }: ReminderEmailProps) {
  const isStart = type === 'world_cup_start';
  const previewText = isStart 
    ? '¡El Mundial está a punto de comenzar!' 
    : '¡Cuidado! Tienes pronósticos vacíos.';

  return (
    <Layout previewText={previewText}>
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        {isStart ? '¡La espera terminó! ⚽' : '¡No dejes puntos en la mesa! ⏰'}
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      {isStart ? (
        <Text className="text-gray-700 text-base">
          El partido inaugural del Mundial 2026 está a menos de 24 horas de comenzar. Asegúrate de tener todos tus pronósticos listos porque una vez que el balón empiece a rodar, los partidos del día se bloquearán.
        </Text>
      ) : (
        <Text className="text-gray-700 text-base">
          Hemos notado que tienes <strong>partidos sin pronosticar</strong> para la jornada de mañana. Recuerda que no llenar tus resultados a tiempo significa perder la oportunidad de sumar puntos valiosos.
        </Text>
      )}

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-green text-white font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/dashboard"
        >
          Llenar mis pronósticos ahora
        </Button>
      </Section>
    </Layout>
  );
}
