import { sendEmail } from '../../lib/resend';
import WelcomeEmail from '../../emails/WelcomeEmail';
import * as React from 'react';

export const GET = async ({ request }) => {
  // Solo para pruebas en desarrollo. En producción, se debe proteger.
  if (import.meta.env.PROD) {
    return new Response(JSON.stringify({ error: 'No disponible en producción' }), { status: 403 });
  }

  // Puedes cambiar esto a cualquier correo real tuyo para probar cómo llega
  const testEmail = 'isealirio@gmail.com'; 

  try {
    const result = await sendEmail({
      to: testEmail,
      subject: 'Prueba de Diseño - Quiniela 2026',
      react: React.createElement(WelcomeEmail, { userName: 'Alirio', isPaymentApproved: true }),
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || result.warning }), { status: 400 });
    }

    return new Response(JSON.stringify({ message: 'Correo enviado exitosamente', data: result.data }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
};
