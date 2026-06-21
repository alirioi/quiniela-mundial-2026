import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface PhaseReminderEmailProps {
  userName: string;
  phaseName: string;
  missingGold?: boolean;
  missingFirstMatch?: boolean;
}

export default function PhaseReminderEmail({
  userName = 'Usuario',
  phaseName = 'Fase',
  missingGold = false,
  missingFirstMatch = false
}: PhaseReminderEmailProps) {
  const previewText = missingGold && missingFirstMatch
    ? 'Faltan tu Pronóstico de Oro y tu primer partido'
    : missingGold
    ? 'Falta completar tu Pronóstico de Oro'
    : 'Falta pronosticar el primer partido del Mundial';

  return (
    <Layout previewText={previewText}>
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        ¡El Mundial está por comenzar! ⏰
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      <Text className="text-gray-700 text-base">
        Faltan pocas horas para el pitazo inicial de la Copa del Mundo y queremos asegurarnos de que no te quedes fuera. Hemos notado que tu cupo tiene los siguientes elementos pendientes:
      </Text>

      <div style={{ margin: '16px 0', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '15px' }}>
          {missingGold && (
            <li style={{ marginBottom: '8px' }}>
              🏆 <strong>Pronóstico de Oro (Desempate):</strong> Define tu campeón, goles del campeón y goles totales de la final. Es obligatorio para desempatar el primer lugar del pote.
            </li>
          )}
          {missingFirstMatch && (
            <li style={{ marginBottom: '8px' }}>
              ⚽ <strong>Primer Partido del Mundial:</strong> Recuerda pronosticar el partido inaugural. Las predicciones de cada partido se bloquean automáticamente <strong>5 minutos antes</strong> de su inicio.
            </li>
          )}
        </ul>
      </div>

      <Text className="text-gray-700 text-base">
        No dejes puntos en la mesa ni pongas en riesgo tu participación. Haz clic en el botón de abajo para completar tus pronósticos ahora mismo.
      </Text>

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
