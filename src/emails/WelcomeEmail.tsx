import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface WelcomeEmailProps {
  userName: string;
  isPaymentApproved: boolean;
}

export default function WelcomeEmail({ userName = 'Usuario', isPaymentApproved = false }: WelcomeEmailProps) {
  const previewText = isPaymentApproved 
    ? '¡Tu pago ha sido aprobado! Tu cuenta está activa.' 
    : '¡Bienvenido a la Quiniela! Tu pago está en revisión.';

  return (
    <Layout previewText={previewText}>
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        ¡Bienvenido a la Quiniela 2026! 🏆
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      {isPaymentApproved ? (
        <>
          <Text className="text-gray-700 text-base">
            ¡Tenemos excelentes noticias! Tu comprobante de pago ha sido <strong>verificado y aprobado</strong> exitosamente.
          </Text>
          <Text className="text-gray-700 text-base">
            Tu cuenta ya se encuentra 100% activa. Ya puedes empezar a llenar tus pronósticos para la fase de grupos. ¡No lo dejes para última hora!
          </Text>
          <Section className="text-center mt-6 mb-6">
            <Button
              className="bg-wc-blue text-white font-bold px-6 py-3 rounded-lg no-underline"
              href="https://quiniela.alirioi.dev/pronosticos"
            >
              Llenar mis pronósticos
            </Button>
          </Section>
        </>
      ) : (
        <>
          <Text className="text-gray-700 text-base">
            Tu cuenta ha sido creada exitosamente. Hemos recibido tu registro y tu comprobante de pago actualmente se encuentra <strong>en revisión</strong> por uno de nuestros administradores.
          </Text>
          <Text className="text-gray-700 text-base">
            Este proceso suele tomar muy poco tiempo. Te enviaremos otro correo en cuanto tu pago sea validado para que puedas comenzar a realizar tus pronósticos.
          </Text>
          <Section className="text-center mt-6 mb-6">
            <Button
              className="bg-gray-800 text-white font-bold px-6 py-3 rounded-lg no-underline"
              href="https://quiniela.alirioi.dev/perfil"
            >
              Ver estado de mi cuenta
            </Button>
          </Section>
        </>
      )}

      <Text className="text-gray-500 text-sm mt-4">
        Si tienes alguna pregunta, no dudes en responder a este correo.
      </Text>
    </Layout>
  );
}
