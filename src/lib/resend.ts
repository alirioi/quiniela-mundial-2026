/**
 * @file resend.ts
 * @description Utilidades para el envío de correos electrónicos utilizando el servicio Resend.
 * Permite enviar correos tanto en formato HTML plano como mediante componentes de React Email.
 */

import { Resend } from 'resend';
import type * as React from 'react';
import { render } from '@react-email/render';

const resendApiKey = import.meta.env.RESEND_API_KEY && import.meta.env.RESEND_API_KEY !== 're_your_api_key' ? import.meta.env.RESEND_API_KEY : '';

/**
 * Instancia del cliente Resend.
 * Se inicializa solo si existe una clave de API válida en las variables de entorno.
 */
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Envía un correo electrónico utilizando Resend.
 * 
 * @param {Object} params - Parámetros del correo electrónico.
 * @param {string | string[]} params.to - Destinatario o lista de destinatarios.
 * @param {string} params.subject - Asunto del correo.
 * @param {string} [params.html] - Contenido del correo en formato HTML.
 * @param {React.ReactElement} [params.react] - Componente React para renderizar como cuerpo del correo.
 * @returns {Promise<{success: boolean, data?: any, error?: any, warning?: string}>} Resultado de la operación de envío.
 */
export async function sendEmail({
  to,
  subject,
  html,
  react,
}: {
  to: string | string[];
  subject: string;
  html?: string;
  react?: React.ReactElement;
}) {
  if (!resend) {
    console.warn('Resend no está configurado (falta RESEND_API_KEY). El email no se enviará.');
    return { success: false, warning: 'SMTP no configurado' };
  }

  try {
    const fromAddress = 'Quiniela 2026 <soporte@alirioi.dev>'; // Usando el dominio verificado
    
    // Si se envía un componente de React, lo renderizamos a HTML puro
    const finalHtml = react ? await render(react) : html;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html: finalHtml || '',
      reply_to: 'isealirio@gmail.com',
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
