import crypto from 'crypto';

const API_KEY = process.env.FLOW_API_KEY;
const SECRET_KEY = process.env.FLOW_SECRET_KEY;
const FLOW_URL = process.env.FLOW_URL;

const FLOW_API_URL = `${FLOW_URL}/payment/create`;

function generarFirma(params, secretKey) {
  const keys = Object.keys(params).filter(k => k !== 's').sort(); // 🔥 Excluye 's'
  let toSign = "";
  keys.forEach(k => {
    toSign += k + params[k];
  });
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}


export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const { amount, orderId, email } = body;
    if (isNaN(amount) || Number(amount) <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "El monto debe ser un número positivo" })
      };
    }

    if (!amount || !orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan parámetros obligatorios (amount, orderId)" })
      };
    }


    const urlBase = process.env.URL_BASE || "https://bus-boleteria.netlify.app";
    //const urlBase = "http://localhost:8888";

    const params = {
      apiKey: API_KEY,
      commerceOrder: orderId,
      amount: amount,
      currency: "CLP",
      timeout: 1800,
      urlReturn: `${urlBase}/.netlify/functions/serveReturn`,
      urlConfirmation: `${urlBase}/.netlify/functions/flowCallback`,
      subject: "Compra de pasajes",
      email: email || 'dgonzalez@wit.la',
    };

    // Ordenar y firmar
    const signature = generarFirma(params, SECRET_KEY);
    params.s = signature;

    // Debug: Mostrar parámetros que se enviarán
    console.log("Parámetros a enviar a Flow:", params);

    const response = await fetch(FLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params).toString()
    });

    const data = await response.json();
    console.log("Respuesta de Flow:", data);

    if (!response.ok) {
      console.error("Error en respuesta de Flow:", data);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Error en Flow API",
          flowError: data
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: `${data.url}?token=${data.token}`,
        flowData: data
      }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error("Error general:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack
      })
    };
  }
}