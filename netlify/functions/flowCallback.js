import crypto from 'crypto';

const API_KEY = process.env.FLOW_API_KEY;
const SECRET_KEY = process.env.FLOW_SECRET_KEY;
const URL = process.env.FLOW_URL;

const FLOW_GETSTATUS_URL = `${URL}/payment/getStatus`;

// Función para firmar parámetros
function generarFirma(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = "";
  keys.forEach(k => {
    toSign += k + params[k];
  });
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    // Flow envía los datos como application/x-www-form-urlencoded
    const params = new URLSearchParams(event.body);
    const token = params.get('token');

    if (!token) {
      return { statusCode: 400, body: 'Token no entregado' };
    }

    // Prepara parámetros para consultar estado del pago
    const data = {
      apiKey: API_KEY,
      token: token
    };

    const signature = generarFirma(data, SECRET_KEY);
    data.s = signature;

    const statusRes = await fetch(FLOW_GETSTATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString()
    });

    const result = await statusRes.json();

    console.log("✅ Estado de pago recibido desde Flow:", result);

    return {
      statusCode: 200,
      body: 'Notificación recibida'
    };

  } catch (err) {
    console.error("❌ Error en callback Flow:", err);
    return {
      statusCode: 500,
      body: 'Error al procesar callback'
    };
  }
}
