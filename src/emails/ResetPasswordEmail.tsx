import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface ResetPasswordEmailProps {
  userName: string;
  resetLink: string;
}

export default function ResetPasswordEmail({ userName = 'Usuario', resetLink = '#' }: ResetPasswordEmailProps) {
  return (
    <Layout previewText="Recupera el acceso a tu cuenta">
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        Restablecer Contraseña 🔒
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola <strong>{userName}</strong>,
      </Text>

      <Text className="text-gray-700 text-base">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en la Quiniela 2026. Si fuiste tú, haz clic en el siguiente botón para crear una nueva contraseña:
      </Text>

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-blue text-white font-bold px-6 py-3 rounded-lg no-underline"
          href={resetLink}
        >
          Crear nueva contraseña
        </Button>
      </Section>

      <Text className="text-gray-700 text-base">
        Si no solicitaste un cambio de contraseña, puedes ignorar este correo con seguridad. Tu cuenta sigue estando protegida.
      </Text>
    </Layout>
  );
}
