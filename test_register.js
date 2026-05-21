import fs from 'fs';

async function test() {
  // Crear una imagen ficticia en buffer
  const fileBuffer = Buffer.from('fakedataimagecontenthere');
  
  const formData = new FormData();
  formData.append('fullName', 'Test QA');
  formData.append('displayName', 'Test QA #1');
  formData.append('email', 'testqa_random_' + Math.floor(Math.random() * 100000) + '@proton.me');
  formData.append('password', 'password123');
  
  // En node moderno, FormData soporta File y Blob
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  formData.append('receipt', blob, 'receipt.png');

  try {
    console.log('Enviando registro a http://localhost:4321/api/auth/register...');
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'http://localhost:4321',
        'Referer': 'http://localhost:4321/register'
      }
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Error al realizar fetch:', err);
  }
}

test();
