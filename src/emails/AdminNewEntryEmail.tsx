import * as React from 'react';
import { Section, Text, Heading, Button } from '@react-email/components';
import Layout from './Layout';

interface AdminNewEntryEmailProps {
  displayName: string;
  paymentMethod: string;
  paymentReference: string;
}

export default function AdminNewEntryEmail({ displayName = 'Usuario', paymentMethod = 'N/A', paymentReference = 'N/A' }: AdminNewEntryEmailProps) {
  return (
    <Layout previewText="Nuevo cupo registrado en la quiniela">
      <Heading className="text-2xl font-bold text-gray-900 text-center mx-0 my-4">
        ¡Nuevo Cupo Registrado! 🚨
      </Heading>
      
      <Text className="text-gray-700 text-base">
        Hola Admin,
      </Text>

      <Text className="text-gray-700 text-base">
        Se ha registrado un nuevo cupo que requiere tu revisión.
      </Text>

      <Text className="text-gray-700 text-base">
        <strong>Apodo/Nombre:</strong> {displayName}<br/>
        <strong>Método de pago:</strong> {paymentMethod}<br/>
        <strong>Referencia:</strong> {paymentReference}
      </Text>

      <Section className="text-center mt-6 mb-6">
        <Button
          className="bg-wc-gold text-slate-900 font-bold px-6 py-3 rounded-lg no-underline"
          href="https://quiniela.alirioi.dev/admin"
        >
          Ir al Panel de Administración
        </Button>
      </Section>
    </Layout>
  );
}
