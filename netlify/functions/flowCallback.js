import crypto from 'crypto';

const API_KEY = process.env.FLOW_API_KEY;
const SECRET_KEY = process.env.FLOW_SECRET_KEY;
const FLOW_URL = process.env.FLOW_URL;

export async function handler(event) {
  
  console.log("⚡ Callback recibido. Método:", event.httpMethod);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    // Parsear el body como x-www-form-urlencoded
    console.log("Headers:", event.headers);
    console.log("Body:", event.body);

    const params = Object.fromEntries(new URLSearchParams(event.body));


    // Verificar firma
    const signature = generarFirma(params, SECRET_KEY);
    if (params.s !== signature) {
      console.error("Firma inválida recibida");
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Firma inválida' })
      };
    }

    // Obtener estado del pago
    const statusData = {
      apiKey: API_KEY,
      token: params.token
    };

    console.log("Token recibido:", params.token);

    statusData.s = generarFirma(statusData, SECRET_KEY);

    const statusRes = await fetch(`${FLOW_URL}/payment/getStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(statusData).toString()
    });

    const result = await statusRes.json();

    if (!statusRes.ok) {
      console.error("Error al verificar estado:", result);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Error al verificar estado de pago",
          flowError: result
        })
      };
    }

    console.log("Resultado de pago:", result);

    if (result.status === 1) {
      const orderId = result.commerceOrder;
      console.log("Pago confirmado para orden:", orderId);

      // Aquí deberías actualizar tu base de datos o sistema
      // para marcar el pago como completado

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          orderId: orderId,
          flowOrder: result.flowOrder,
          amount: result.amount
        })
      };
    } else {
      console.log("Pago no aprobado. Estado:", result.status);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Pago no completado',
          status: result.status
        })
      };
    }

  } catch (err) {
    console.error("❌ Error en callback Flow:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error al procesar callback',
        message: err.message
      })
    };
  }
}

function generarFirma(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = "";
  keys.forEach(k => {
    toSign += k + params[k];
  });
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}