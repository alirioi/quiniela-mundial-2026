import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface PhaseReminderEmailProps {
  userName: string;
  phaseName: string;
}

export default function PhaseReminderEmail({ userName = 'Usuario', phaseName = 'Fase' }: PhaseReminderEmailProps) {
  return (
    <Layout previewText={`Faltan pronósticos para la ${phaseName}`}>
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        ¡No dejes puntos en la mesa! ⏰
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      <Text className="text-gray-700 text-base">
        Hemos notado que tienes <strong>partidos sin pronosticar</strong> para la <strong>{phaseName}</strong>. Recuerda que los partidos se bloquean automáticamente 2 horas antes de su pitazo inicial. No llenar tus resultados a tiempo significa perder la oportunidad de sumar puntos valiosos.
      </Text>

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-green text-white font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/dashboard/predicciones"
        >
          Llenar mis pronósticos ahora
        </Button>
      </Section>
    </Layout>
  );
}
