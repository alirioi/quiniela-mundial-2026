import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface PhaseChangeEmailProps {
  userName: string;
}

export default function PhaseChangeEmail({ userName = 'Usuario' }: PhaseChangeEmailProps) {
  return (
    <Layout previewText="¡Inicia la Fase Eliminatoria!">
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        ¡Comienzan los Octavos de Final! 🔥
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      <Text className="text-gray-700 text-base">
        La fase de grupos ha terminado y ahora comienza la verdadera tensión. Ya conocemos los clasificados y los cruces de los Octavos de Final.
      </Text>
      
      <Text className="text-gray-700 text-base">
        A partir de este momento, ya tienes habilitada la sección para realizar tus pronósticos de la fase eliminatoria. ¡Es hora de demostrar cuánto sabes de fútbol!
      </Text>

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-blue text-white font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/predictions/eliminatorias"
        >
          Llenar pronósticos de Octavos
        </Button>
      </Section>
    </Layout>
  );
}
