import crypto from 'crypto';

const API_KEY = process.env.FLOW_API_KEY;
const SECRET_KEY = process.env.FLOW_SECRET_KEY;
const URL = process.env.FLOW_URL;

const FLOW_API_URL = `${URL}/payment/create`;

const urlBase = process.env.URL_BASE || "https://bus-boleteria.netlify.app";

function generarFirma(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = "";
  keys.forEach(k => {
    toSign += k + params[k];
  });
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

export async function handler(event) {
  try {
    // Recibe datos del frontend (por ejemplo monto, orden)
    const body = JSON.parse(event.body);
    const { amount, orderId, urlReturn, urlConfirmation } = body;
    if (!amount || !orderId || !urlReturn || !urlConfirmation) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan parámetros obligatorios" })
      };
    }


    // Prepara parámetros para Flow
    const params = {
      apiKey: API_KEY,
      commerceOrder: orderId,
      amount: amount,
      currency: "CLP",
      urlReturn: urlReturn,
      urlConfirmation: `${urlBase}/.netlify/functions/flowCallback`,
      subject: "Compra de pasajes",
      email: "sandoval.jesus2005@gmail.com"
    };

    // Firma los parámetros
    const signature = generarFirma(params, SECRET_KEY);
    params.s = signature;

    // Convierte params a x-www-form-urlencoded
    const formBody = new URLSearchParams(params);

    // Llama a Flow para crear la transacción
    const res = await fetch(FLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { statusCode: 500, body: `Error Flow API: ${errorText}` };
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Error en Flow");
    }

    // Devuelve URL para redirigir al usuario
    return {
      statusCode: 200,
      body: JSON.stringify({
        url: data.url,
        flowData: data
      }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
