let pagoTotal = [];

exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
    try {
      const pago = JSON.parse(event.body);

      pagoTotal.push(pago);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, mensaje: 'Pago registrado', pago }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error al guardar el pago', detail: error.message }),
      };
    }
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({ pagos: pagoTotal }),
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Método no permitido' }),
  };
};
