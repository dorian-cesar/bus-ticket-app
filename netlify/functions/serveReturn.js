import fs from 'fs';
import path from 'path';

export async function handler(event, context) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'return.html');
    const html = fs.readFileSync(filePath, 'utf8');

    const buffer = Buffer.from(html, 'utf8');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error("Error en serveReturn:", error);
    return {
      statusCode: 500,
      body: 'Error al procesar la página de retorno'
    };
  }
}