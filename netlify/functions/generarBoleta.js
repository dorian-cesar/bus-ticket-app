const iconv = require('iconv-lite');

exports.handler = async (event) => {
    try {
        const movimiento = JSON.parse(event.body);

        if (!movimiento || !movimiento.asientos || !Array.isArray(movimiento.asientos)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, error: 'Datos de movimiento inválidos' })
            };
        }

        const ESC = '\x1B';
        const LF = '\x0A';

        const formatLine = (text = '', width = 32) => {
            if (text.length > width) return text.slice(0, width);
            const spaces = ' '.repeat(Math.floor((width - text.length) / 2));
            return spaces + text;
        };

        let content = '';

        // Encabezado
        content += ESC + '@'; // Reset
        content += ESC + '!' + '\x38'; // Fuente doble ancho y alto
        content += `${movimiento.empresa}` + LF;
        content += ESC + '!' + '\x00'; // Fuente normal
        content += formatLine('BOLETA DE VENTA') + LF;
        content += '-'.repeat(32) + LF;

        content += `Servicio: ${movimiento.servicioId}` + LF;
        content += `Origen: ${movimiento.origen}` + LF;
        content += `Destino: ${movimiento.destino}` + LF;
        content += `Hora salida: ${movimiento.horaSalida}` + LF + LF;

        content += `Cliente: ${movimiento.cliente || 'N/A'}` + LF;
        content += `Vendedor: ${movimiento.usuario}` + LF;
        content += `Fecha: ${new Date(movimiento.fecha).toLocaleString()}` + LF;
        content += `Medio de pago: ${movimiento.medioPago.toUpperCase()}` + LF + LF;

        content += 'Asientos:' + LF;
        movimiento.asientos.forEach(a => {
            const linea = `  #${a.seat} Piso ${a.floor} $${a.price}`;
            content += linea + LF;
        });

        content += '-'.repeat(32) + LF;
        content += `TOTAL:           $${movimiento.monto}` + LF;
        content += `Transacción: ${movimiento.nroTransaccion}` + LF + LF;
        content += 'Gracias por su compra!' + LF + LF;

        // Corte de papel
        content += ESC + 'm';

        // Convertir a buffer y luego a base64
        const buffer = iconv.encode(content, 'CP437'); // CP437 o CP850 para compatibilidad
        const base64 = buffer.toString('base64');

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, printDataBase64: base64 })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
