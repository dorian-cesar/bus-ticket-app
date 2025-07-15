import crypto from 'crypto';

const FLOW_SANDBOX_KEY = process.env.FLOW_SANDBOX_KEY;
const FLOW_SANDBOX_SECRET = process.env.FLOW_SANDBOX_SECRET;
const FLOW_URL_SANDBOX = process.env.FLOW_URL_SANDBOX;

function signParams(params, secretKey) {
  const keys = Object.keys(params).filter(k => k !== 's').sort();
  let toSign = '';
  keys.forEach(k => {
    toSign += k + params[k];
  });
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

export async function handler(event) {
  try {
    const { orderId, token } = JSON.parse(event.body);

    if (!token || !orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan parámetros (token, orderId)" })
      };
    }

    const params = {
      apiKey: FLOW_SANDBOX_KEY,
      token
    };
    params.s = signParams(params, FLOW_SANDBOX_SECRET);

    const url = `${FLOW_URL_SANDBOX}/payment/getStatus?` + new URLSearchParams(params).toString();
    const response = await fetch(url);
    const raw = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Error al consultar Flow directamente",
          raw,
          status: response.status
        })
      };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes("application/json")) {
      const data = JSON.parse(raw);
      return {
        statusCode: 200,
        body: JSON.stringify(data)
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Respuesta inesperada de Flow (no es JSON)",
          raw
        })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
