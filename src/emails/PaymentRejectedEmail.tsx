import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface PaymentRejectedEmailProps {
  userName: string;
  reason?: string;
}

export default function PaymentRejectedEmail({ userName = 'Usuario', reason }: PaymentRejectedEmailProps) {
  return (
    <Layout previewText="Problemas con tu comprobante de pago">
      <Heading className="text-2xl font-bold text-wc-red text-center mx-0 my-4">
        ¡Atención con tu pago! ⚠️
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      <Text className="text-gray-700 text-base">
        Hemos revisado el comprobante de pago que subiste a la Quiniela 2026, pero lamentablemente <strong>no pudimos validarlo</strong>.
      </Text>

      {reason && (
        <Section className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
          <Text className="text-red-800 text-sm m-0">
            <strong>Motivo:</strong> {reason}
          </Text>
        </Section>
      )}

      <Text className="text-gray-700 text-base">
        Para activar tu cuenta y poder participar, por favor ingresa nuevamente a la plataforma y sube un comprobante válido.
      </Text>

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-red text-white font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/perfil"
        >
          Subir nuevo comprobante
        </Button>
      </Section>

      <Text className="text-gray-500 text-sm mt-4">
        Si crees que esto es un error o necesitas ayuda, responde a este correo para contactar a soporte.
      </Text>
    </Layout>
  );
}
