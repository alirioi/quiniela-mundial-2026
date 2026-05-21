import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY || '';

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn('Resend no está configurado (falta RESEND_API_KEY). El email no se enviará.');
    return { success: false, warning: 'SMTP no configurado' };
  }

  try {
    const fromAddress = 'Quiniela 2026 <onboarding@resend.dev>'; // Se puede cambiar a un dominio verificado cuando esté listo
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Error al enviar email con Resend:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error('Excepción al enviar email con Resend:', e);
    return { success: false, error: e };
  }
}
