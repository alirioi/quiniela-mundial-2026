import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface WinnerEmailProps {
  userName: string;
  prizeAmount?: string;
}

export default function WinnerEmail({ userName = 'Campeón', prizeAmount }: WinnerEmailProps) {
  return (
    <Layout previewText="¡ERES EL GANADOR DE LA QUINIELA!">
      <Section className="text-center mb-6">
        <Text className="text-6xl m-0">🏆</Text>
      </Section>
      <Heading className="text-3xl font-bold text-wc-gold text-center mx-0 my-4 uppercase tracking-wider">
        ¡Tenemos un Campeón!
      </Heading>
      
      <Text className="text-gray-700 text-base text-center">
        ¡Felicidades <strong>{userName}</strong>!
      </Text>

      <Text className="text-gray-700 text-base text-center">
        Has demostrado ser el mejor estratega. El Mundial de 2026 ha terminado y tú has quedado en el primer lugar de nuestra tabla de posiciones.
      </Text>

      {prizeAmount && (
        <Section className="bg-yellow-50 border border-yellow-200 rounded-md p-6 my-6 text-center shadow-inner">
          <Text className="text-yellow-800 text-lg m-0 font-bold">
            Premio Total
          </Text>
          <Text className="text-wc-gold text-4xl m-0 font-extrabold mt-2">
            {prizeAmount}
          </Text>
        </Section>
      )}

      <Text className="text-gray-700 text-base text-center mt-6">
        En breve, un administrador se pondrá en contacto contigo para coordinar la entrega de tu premio. ¡Disfruta la victoria!
      </Text>

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-gold text-gray-900 font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/leaderboard"
        >
          Ver tabla final
        </Button>
      </Section>
    </Layout>
  );
}
