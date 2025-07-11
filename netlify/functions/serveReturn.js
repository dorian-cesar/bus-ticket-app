import fs from 'fs';
import path from 'path';

export async function handler(event, context) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'return.html');
    const html = fs.readFileSync(filePath, 'utf8');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      },
      body: html
    };
  } catch (err) {
    console.error('Error en serveReturn:', err);
    return {
      statusCode: 500,
      body: 'Error al procesar la página de retorno'
    };
  }
}
