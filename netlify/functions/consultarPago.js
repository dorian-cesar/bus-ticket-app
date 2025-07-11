export async function handler(event) {
  try {
    const { orderId, token } = JSON.parse(event.body);

    const url = `http://sandbox.dev-wit.com/api/paymentStatus/${orderId}?token=${token}`;
    const response = await fetch(url);

    const contentType = response.headers.get('content-type');
    const raw = await response.text();

    // Mostrar la respuesta cruda en consola
    console.log("Respuesta cruda:", raw);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Error al consultar Flow",
          raw,
          status: response.status
        })
      };
    }

    // Asegurar que la respuesta es JSON antes de parsear
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
          error: "Respuesta inesperada (no es JSON)",
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
