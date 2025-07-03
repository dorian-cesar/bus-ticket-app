import crypto from 'crypto';

const API_KEY = process.env.FLOW_API_KEY;
const SECRET_KEY = process.env.FLOW_SECRET_KEY;
const FLOW_URL = process.env.FLOW_URL;

function generarFirma(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = '';
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
    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token requerido' })
      };
    }

    const params = {
      apiKey: API_KEY,
      token
    };
    params.s = generarFirma(params, SECRET_KEY);

    const response = await fetch(`${FLOW_URL}/payment/getStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error en Flow', flowError: result })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno', message: err.message })
    };
  }
}
