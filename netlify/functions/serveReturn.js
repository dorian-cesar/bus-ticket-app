import fs from 'fs';
import path from 'path';

export async function handler(event, context) {
    try {
        // Leer el archivo return.html
        const filePath = path.join(process.cwd(), 'public', 'return.html');
        let html = fs.readFileSync(filePath, 'utf8');

        // Si es POST, procesar los parámetros
        if (event.httpMethod === 'POST') {
            const params = new URLSearchParams(event.body);
            const token = params.get('token');
            const status = params.get('status');

            // Inyectar script con los parámetros
            const scriptInjection = `
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const token = "${token || ''}";
            const status = "${status || '0'}";
            
            console.log('Token recibido:', token);
            console.log('Status recibido:', status);
            
            if (token) {
              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage({
                    tipo: 'pagoCompletado',
                    token: token,
                    status: status
                  }, '*');
                  
                  setTimeout(() => window.close(), 5000);
                }
              } catch (e) {
                console.error('Error en postMessage:', e);
              }
            }
          });
        </script>
      `;

            html = html.replace('</head>', scriptInjection + '</head>');
        }

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