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
    const params = Object.fromEntries(new URLSearchParams(event.body));
    const signature = generarFirma(params, SECRET_KEY);


    if (params.s !== signature) {
      return { statusCode: 401, body: 'Firma inválida' };
    }

    const statusData = { apiKey: API_KEY, token: params.token };
    statusData.s = generarFirma(statusData, SECRET_KEY);

    const statusRes = await fetch(FLOW_GETSTATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(statusData).toString()
    });

    const result = await statusRes.json();

    console.log("pago enviado", result);

    if (result.status === 'paid') {
      const orderId = result.commerceOrder; // Ej: "orden_123456"      
      console.log("confirmar asientos")
    }

    if (result.status !== 'paid') {
      console.log("❌ Pago no aprobado. Estado:", result.status);
      return { statusCode: 400, body: 'Pago no completado' };
    }

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
