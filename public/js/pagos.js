function generarIdUnico() {
    return 'ORDER-' + Date.now();
}

function esCorreoValido(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.toLowerCase());
}

/*================================================================================================================
|----------------------------------------------------  MODAL  ----------------------------------------------------|
================================================================================================================*/

$(document).on('click', '#openPaymentModal', function () {
    $('#paymentModal').fadeIn(300).addClass('show');
    document.body.style.overflow = 'hidden';
});

// Función para ocultar modal
function hideModal() {
    $('#paymentModal').fadeOut(300, function () {
        $(this).removeClass('show');
        document.body.style.overflow = '';
    });
}

// Cerrar modal al hacer clic en los botones de cerrar
// Resetear completamente el modal al cerrarlo con el botón "Aceptar" luego de un pago exitoso
$(document).on('click', '.btn-close-modal', function () {
    hideModal();

    // Restaurar contenido original del modal después de 300ms (duración del fadeOut)
    setTimeout(() => {
        $('#paymentModal .modal-body').html(`
            <button id="payWeb" class="btn btn-primary">Pago Web</button>
            <button id="payCard" class="btn btn-primary">Pago con Tarjeta</button>
            <button id="payCash" class="btn btn-success">Pago en Efectivo</button>
            <button class="btn btn-secondary btn-close-modal">Cancelar</button>
        `);

        initPaymentButtons(); // Volver a enlazar eventos de pago
    }, 300);
});


// Cerrar modal al hacer clic fuera del contenido
$('#paymentModal').on('click', function (e) {
    if (e.target === this) hideModal();
});

// Cerrar modal con tecla ESC
$(document).on('keydown', function (e) {
    if (e.key === 'Escape' && $('#paymentModal').hasClass('show')) {
        hideModal();
    }
});

function initPaymentButtons() {
    $(document).off('click', '#payWeb, #payCash, #payCard').on('click', '#payWeb, #payCash, #payCard', handlePayment);
}

function obtenerMensajeErrorFlow(codigo) {
    if (!codigo) return "❌ Error desconocido en el proceso de pago";

    const code = Number(codigo);
    const errores = {
        '4': "❌ Compra Anulada",
        '3': "❌ Tarjeta rechazada",
        '-1': "❌ Tarjeta inválida",
        '-2': "❌ Error de conexión con el medio de pago",
        '-3': "❌ Excede el monto máximo permitido",
        '-4': "❌ Fecha de expiración inválida",
        '-5': "❌ Problema en la autenticación de la tarjeta",
        '-6': "❌ Rechazo general de la transacción",
        '-7': "❌ Tarjeta bloqueada",
        '-8': "❌ Tarjeta vencida",
        '-9': "❌ Transacción no soportada por el medio de pago",
        '-10': "❌ Problema interno en la transacción",
        '-11': "❌ Límite de reintentos de rechazos excedido",
        '999': "❌ Error desconocido en el proceso de pago",
        'popup_blocked': "❌ El navegador bloqueó la ventana de pago. Por favor habilita popups para este sitio.",
        'invalid_amount': "❌ Monto de pago inválido",
        'network_error': "❌ Error de conexión. Verifica tu internet e intenta nuevamente."
    };

    return errores[code] || errores[code.toString()] || `❌ Error en el pago (Código: ${codigo})`;
}

function obtenerMensajeErrorPOS(codigo) {
    const mensajes = {
        1: "❌ Transacción rechazada por el emisor.",
        2: "❌ Transacción no autorizada.",
        3: "❌ Transacción denegada.",
        4: "❌ Tarjeta inválida o vencida.",
        5: "❌ Error en datos de la tarjeta.",
        6: "❌ Error de comunicación con el POS.",
        7: "❌ Transacción cancelada por el usuario.",
        8: "❌ Monto excede el permitido.",
        9: "❌ No se puede procesar la tarjeta.",
        10: "❌ POS sin respuesta.",
        12: "❌ Error de procesamiento.",
        14: "❌ Tarjeta no reconocida.",
        15: "❌ Comercio no autorizado.",
        91: "❌ Emisor no disponible.",
        99: "❌ Error desconocido o sin clasificar.",
    };

    return mensajes[codigo] || `❌ Error en la transacción (Código ${codigo})`;
}

/*================================================================================================================
|----------------------------------------------------  PAGOS  ----------------------------------------------------|
================================================================================================================*/

async function handlePayment() {
    const method = this.id === 'payWeb' ? 'web' : this.id === 'payCash' ? 'cash' : this.id === 'payCard' ? 'card' : null;

    const $modal = $('#paymentModal');

    // Mostrar estado de carga
    $modal.find('.modal-body').html(`
        <div class="payment-loading">
            <div class="spinner"></div>
            <p>Preparando pago...</p>
        </div>
    `);

    if (method === 'web') {
        const amount = getTotalPrice();

        try {
            if (amount <= 0) {
                throw new Error("Monto inválido para el pago");
            }

            // Mostrar formulario para ingresar correo antes de redirigir al pago
            $modal.find('.modal-body').html(`
                <div class="payment-web-confirmation">
                    <h4>¿Confirmar pago con tarjeta?</h4>
                    <p>Los asientos seleccionados se reservarán como pagados una vez aprobado el pago.</p>
                    
                    <div class="correocliente">
                        <label for="clienteEmail">Correo del cliente (opcional)</label>
                        <input type="email" id="clienteEmailWeb" class="correo-cliente" placeholder="cliente@correo.com">
                    </div>
    
                    <div class="web-actions mt-4">
                        <button class="btn btn-primary btn-continue-web-payment">Continuar con Pago</button>
                        <button class="btn btn-secondary btn-cancel-payment btn-close-modal">Cancelar</button>
                    </div>
                </div>
            `);

        } catch (error) {
            console.error("Error en pago web:", error);
            $modal.find('.modal-body').html(`
                <div class="payment-error">
                    <h4>Error al iniciar pago</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary btn-close-modal">Volver</button>
                </div>
            `);
        }
    }

    if (method === 'cash') {
        const amount = getTotalPrice();
        try {
            if (amount <= 0) {
                throw new Error("Monto inválido para el pago");
            }
            $modal.find('.modal-body').html(`
                <div class="payment-cash-confirmation">
                    <h4>¿Confirmar pago en efectivo?</h4>
                    <p>Los asientos seleccionados se reservarán como pagados.</p>
                    
                    <div class="correocliente">
                        <label for="clienteEmail">Correo del cliente (opcional)</label>
                        <input type="email" id="clienteEmail" class="correo-cliente" placeholder="cliente@correo.com">
                    </div>
    
                    <div class="cash-actions mt-4">
                        <button class="btn btn-success btn-confirm-cash">Confirmar</button>
                        <button class="btn btn-secondary btn-cancel-payment btn-close-modal">Cancelar y Liberar Asientos</button>
                    </div>
                </div>
            `);
        } catch (error) {
            console.error("Error en pago manual:", error);
            $modal.find('.modal-body').html(`
                <div class="payment-error">
                    <h4>Error al iniciar pago</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary btn-close-modal">Volver</button>
                </div>
            `);
        }
    }

    if (method === 'card') {
        const amount = getTotalPrice();
        try {
            if (amount <= 0) throw new Error("Monto inválido para el pago");

            // Mostrar formulario previo al pago
            $modal.find('.modal-body').html(`
                <div class="payment-card-confirmation">
                    <h4>¿Confirmar pago con tarjeta?</h4>
                    <p>Este pago se procesará a través del POS físico conectado.</p>
                    
                    <div class="correocliente">
                        <label for="clienteEmailCard">Correo del cliente (opcional)</label>
                        <input type="email" id="clienteEmailCard" class="correo-cliente" placeholder="cliente@correo.com">
                    </div>
    
                    <div class="card-actions mt-4">
                        <button class="btn btn-primary btn-confirm-card">Confirmar Pago</button>
                        <button class="btn btn-secondary btn-cancel-payment btn-close-modal">Cancelar</button>
                    </div>
                </div>
            `);

        } catch (error) {
            console.error("Error al preparar pago con tarjeta:", error);
            $modal.find('.modal-body').html(`
                <div class="payment-error">
                    <h4>Error al iniciar pago</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary btn-close-modal">Volver</button>
                </div>
            `);
        }
    }


}

/*===============================================================
|--------------------------  PAGO WEB  --------------------------|
=================================================================*/

let pollingActivo = false;
let pollingInterval = null;

$(document).on('click', '.btn-continue-web-payment', async function () {
    if (pollingActivo) return;

    const emailCliente = $('#clienteEmailWeb').val()?.trim() || '';
    if (emailCliente && !esCorreoValido(emailCliente)) {
        alert("El correo ingresado no es válido.");
        return;
    }

    const amount = getTotalPrice();
    const orderId = generarIdUnico();
    const $modal = $('#paymentModal');

    try {
        if (amount <= 0) throw new Error("Monto inválido para el pago");

        const paymentData = {
            serviceId: currentServiceId,
            seats: selectedSeats,
            token: jwtToken,
            cliente: emailCliente,
            amount: amount,
            orderId: orderId,
            timestamp: Date.now()
        };
        localStorage.setItem('pendingPayment', JSON.stringify(paymentData));

        $modal.find('.modal-body').html(`
            <div class="payment-loading">
                <div class="spinner"></div>
                <p>Redirigiendo a pasarela de pago...</p>
                <p class="small">Serás redirigido a una nueva pestaña para completar el pago.</p>
            </div>
        `);

        const res = await fetch('/.netlify/functions/crearPago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                orderId,
                urlReturn: `${window.location.origin}/.netlify/functions/serveReturn`,
                urlConfirmation: 'http://sandbox.dev-wit.com/api/paymentConfirmation',
                email: emailCliente
            })
        });

        const data = await res.json();
        if (!res.ok || !data.url || !data.flowData?.token) {
            throw new Error("Error creando pago o token ausente");
        }

        localStorage.setItem('currentPayment', JSON.stringify({
            orderId,
            token: data.flowData.token,
            amount,
            timestamp: Date.now()
        }));

        const paymentTab = window.open(data.url, '_blank');
        if (!paymentTab) throw new Error("Popup bloqueado por el navegador");

        let intentos = 0;
        const maxIntentos = 30;

        const iniciarPolling = () => {
            if (pollingActivo) {
                console.warn("ya hay un polling activo, no se inicia de nuevo.")
                return;
            };
            pollingActivo = true;
            clearInterval(pollingInterval);
            pollingInterval = setInterval(async () => {
                intentos++;
                try {
                    if (document.visibilityState === 'visible') {
                        const estadoRes = await fetch('/.netlify/functions/consultarPago', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId, token: data.flowData.token })
                        });

                        const resultado = await estadoRes.json();

                        if (resultado.status === 2) {
                            clearInterval(pollingInterval);
                            pollingActivo = false;
                            if (paymentTab && !paymentTab.closed) paymentTab.close();

                            let processed = 0;
                            let errores = 0;

                            selectedSeats.forEach(s => {
                                $.ajax({
                                    url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
                                    method: 'POST',
                                    headers: {
                                        Authorization: jwtToken,
                                        'Content-Type': 'application/json'
                                    },
                                    data: JSON.stringify({
                                        seatNumber: s.seat,
                                        authCode: 'AUTHWEB123',
                                        userId: user?.email || 'desconocido'
                                    }),
                                    success: () => {
                                        $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('reserved').off('click');
                                        processed++;

                                        if (processed === selectedSeats.length) {
                                            if (errores === 0) {
                                                registrarMovimientoWeb(resultado);
                                            } else {
                                                showPaymentResult($modal, false);
                                            }
                                        }
                                    },
                                    error: () => {
                                        processed++;
                                        errores++;

                                        if (processed === selectedSeats.length) {
                                            showPaymentResult($modal, false);
                                        }
                                    }
                                });
                            });

                            function registrarMovimientoWeb(pagoInfo) {
                                const movimiento = {
                                    empresa: currentServiceData?.company || 'Empresa desconocida',
                                    caja: idCaja,
                                    tipo: 'ingreso',
                                    medioPago: 'tarjeta',
                                    monto: amount,
                                    servicioId: currentServiceId,
                                    origen: currentServiceData?.origin || $('#origin').val(),
                                    destino: currentServiceData?.destination || $('#destination').val(),
                                    horaSalida: currentServiceData?.departureTime || '--:--',
                                    cliente: emailCliente,
                                    descripcion: `Venta de pasajes servicio ${currentServiceId}`,
                                    fecha: new Date().toISOString(),
                                    usuario: user.email,
                                    nroTransaccion: orderId,
                                    asientos: selectedSeats.map(s => ({
                                        seat: s.seat,
                                        floor: s.floor,
                                        price: s.price
                                    })),
                                    datosPago: {
                                        metodo: 'web',
                                        tokenFlow: pagoInfo.token,
                                        idPago: pagoInfo.flowOrderId || pagoInfo.orderId
                                    }
                                };

                                fetch('https://boletos.dev-wit.com/api/movimientos', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(movimiento)
                                })
                                    .then(async res => {
                                        const data = await res.json();
                                        if (!res.ok) {
                                            throw new Error('Error al registrar el movimiento: ' + data.message || 'Respuesta no válida del servidor');
                                        }

                                        console.log('Pago registrado');
                                        generarBoleta(movimiento);
                                        showPaymentResult($modal, true);
                                        resetTravelSummary();
                                    })
                                    .catch(err => {
                                        console.error('Error al registrar el pago:', err);

                                        // ✅ Si ya fue cobrado pero falló solo el render de la boleta, no mostrar "error en el pago"
                                        $modal.find('.modal-body').html(`
                                      <div class="payment-warning">
                                        <h3>Pago realizado correctamente</h3>
                                        <p>Se detectó un problema al generar la boleta, pero tu transacción fue registrada.</p>
                                        <button class="btn btn-secondary btn-close-modal">Aceptar</button>
                                      </div>
                                    `);
                                    });
                            }
                        } else if ([3, 4].includes(resultado.status)) {
                            console.log("Pago rechazado o error con status:", resultado.status);
                            clearInterval(pollingInterval);
                            pollingActivo = false;
                            handlePaymentResult(false, {
                                status: resultado.status,
                                message: obtenerMensajeErrorFlow(resultado.status),
                                orderId,
                                isWebPayment: true
                            });
                            localStorage.removeItem('currentPayment');
                        } else {
                            clearInterval(pollingInterval);
                            pollingActivo = false;
                            handlePaymentResult(false, {
                                status: resultado.status,
                                message: 'Estado de pago desconocido. Por favor intente nuevamente.',
                                orderId,
                                isWebPayment: true
                            });
                            localStorage.removeItem('currentPayment');
                        }


                        if (intentos >= maxIntentos) {
                            pollingActivo = false;
                            clearInterval(pollingInterval);
                            handlePaymentResult(false, {
                                message: "Tiempo de espera agotado",
                                orderId,
                                isWebPayment: true
                            });
                            localStorage.removeItem('currentPayment');
                        }
                    }
                } catch (pollingError) {
                    clearInterval(pollingInterval);
                    pollingActivo = false;
                    console.error("Error en polling:", pollingError);
                    handlePaymentResult(false, {
                        message: "Error al verificar el estado del pago",
                        orderId,
                        isWebPayment: true
                    });
                }
            }, 2000);
        };

        iniciarPolling(); // inicial

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                iniciarPolling(); // reinicia polling al volver a la pestaña
            }
        });

    } catch (error) {
        console.error("Error en continuar con pago:", error);
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <h4>Error al iniciar pago</h4>
                <p>${error.message}</p>
                <button class="btn btn-secondary btn-close-modal">Volver</button>
            </div>
        `);
    }
});

/*===============================================================
|--------------------------  PAGO CARD  --------------------------|
=================================================================*/

$(document).on('click', '.btn-confirm-card', async function () {
    const $modal = $('#paymentModal');
    const amount = getTotalPrice();
    const now = new Date();
    const orderId = generarIdUnico();
    const emailCliente = $('#clienteEmailCard').val()?.trim() || '';

    if (emailCliente && !esCorreoValido(emailCliente)) {
        alert("El correo ingresado no es válido.");
        return;
    }

    let processed = 0;
    let errores = 0;

    try {
        $modal.find('.modal-body').html(`
            <div class="payment-loading">
                <div class="spinner"></div>
                <p>Conectando con el POS...</p>
            </div>
        `);

        const res = await fetch('https://localhost:3000/api/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, ticketNumber: orderId })
        });

        const data = await res.json();

        if (!res.ok || !data.success || data.data?.responseCode !== 0) {
            const msg = obtenerMensajeErrorPOS(data.data?.responseCode);
            throw new Error(msg || data.message || "Error en la transacción con POS");
        }


        const resultado = data.data;

        // Confirmar asientos
        selectedSeats.forEach(s => {
            $.ajax({
                url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
                method: 'POST',
                headers: {
                    Authorization: jwtToken,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    seatNumber: s.seat,
                    authCode: 'AUTHCARD123',
                    userId: user?.email || 'desconocido'
                }),
                success: () => {
                    $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('reserved').off('click');
                    processed++;

                    if (processed === selectedSeats.length) {
                        if (errores === 0) {
                            registrarMovimientoTarjeta();
                        } else {
                            showPaymentResult($modal, false);
                            console.warn("No todos los asientos se confirmaron correctamente");
                        }
                    }
                },
                error: () => {
                    processed++;
                    errores++;

                    if (processed === selectedSeats.length) {
                        showPaymentResult($modal, false);
                    }
                }
            });
        });

        function registrarMovimientoTarjeta() {
            const movimiento = {
                empresa: currentServiceData?.company || 'Empresa desconocida',
                caja: idCaja,
                tipo: 'ingreso',
                medioPago: 'tarjeta',
                monto: amount,
                servicioId: currentServiceId,
                origen: currentServiceData?.origin || $('#origin').val(),
                destino: currentServiceData?.destination || $('#destination').val(),
                horaSalida: currentServiceData?.departureTime || '--:--',
                cliente: emailCliente,
                descripcion: `Venta de pasajes servicio ${currentServiceId}`,
                fecha: now.toISOString(),
                usuario: user.email,
                nroTransaccion: orderId,
                asientos: selectedSeats.map(s => ({
                    seat: s.seat,
                    floor: s.floor,
                    price: s.price
                })),
                datosPago: {
                    metodo: 'tarjeta',
                    ultimosDigitos: resultado.last4Digits || '',
                    marca: resultado.cardBrand || '',
                    codigoAutorizacion: resultado.authorizationCode || ''
                }
            };

            fetch('https://boletos.dev-wit.com/api/movimientos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movimiento)
            })
                .then(res => res.json())
                .then(data => {
                    console.log('Pago registrado');
                    generarBoleta(movimiento);
                    showPaymentResult($modal, true);
                    resetTravelSummary();
                })
                .catch(err => {
                    console.error('Error al registrar el pago:', err);
                    showPaymentResult($modal, false);
                });
        }

    } catch (error) {
        console.error("Error con POS:", error);
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <h4>Error al pagar con POS</h4>
                <p>${error.message}</p>
                <button class="btn btn-secondary btn-close-modal">Volver</button>
            </div>
        `);
    }
});

/*===============================================================
|--------------------------  PAGO CASH  --------------------------|
=================================================================*/

$(document).on('click', '.btn-confirm-cash', async function () {
    const $modal = $('#paymentModal');
    const amount = getTotalPrice();
    const now = new Date();
    const orderId = generarIdUnico();

    let processed = 0;
    let errores = 0;

    $(this).prop('disabled', true);

    // Confirmar los asientos primero
    selectedSeats.forEach(s => {
        $.ajax({
            url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
            method: 'POST',
            headers: {
                Authorization: jwtToken,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                seatNumber: s.seat,
                authCode: 'AUTHCASH123',
                userId: user?.email || 'desconocido'
            }),
            success: () => {
                $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('reserved').off('click');
                processed++;

                if (processed === selectedSeats.length) {
                    if (errores === 0) {
                        registrarMovimientoEfectivo();
                    } else {
                        showPaymentResult($modal, false);
                        console.warn("No todos los asientos se confirmaron correctamente");
                    }
                }
            },
            error: () => {
                processed++;
                errores++;

                if (processed === selectedSeats.length) {
                    showPaymentResult($modal, false);
                }
            }
        });
    });

    function registrarMovimientoEfectivo() {
        const emailCliente = $('#clienteEmail').val()?.trim() || '';
        const movimiento = {
            empresa: currentServiceData?.company || 'Empresa desconocida',
            caja: idCaja,
            tipo: 'ingreso',
            medioPago: 'efectivo',
            monto: amount,
            servicioId: currentServiceId,
            origen: currentServiceData?.origin || $('#origin').val(),
            destino: currentServiceData?.destination || $('#destination').val(),
            horaSalida: currentServiceData?.departureTime || '--:--',
            cliente: emailCliente,
            descripcion: `Venta de pasajes servicio ${currentServiceId}`,
            fecha: now.toISOString(),
            usuario: user.email,
            nroTransaccion: orderId,
            asientos: selectedSeats.map(s => ({
                seat: s.seat,
                floor: s.floor,
                price: s.price
            }))
        };


        fetch('https://boletos.dev-wit.com/api/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movimiento)
        })
            .then(res => res.json())
            .then(data => {
                console.log('Pago registrado');
                generarBoleta(movimiento);
                showPaymentResult($modal, true);
            })
            .catch(err => {
                console.error('Error al registrar el pago:', err);
                showPaymentResult($modal, false);
            });
    }
});

/*================================================================================================================
|--------------------------------------------------  ACCIONES  --------------------------------------------------|
================================================================================================================*/

/*===============================================================
|-----------------------  REINTENTAR PAGO  -----------------------|
=================================================================*/

$(document).on('click', '.btn-retry-payment', async function () {
    const $modal = $('#paymentModal');
    const $btn = $(this);

    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...');

    try {
        $modal.find('.modal-body').html(`
            <div class="payment-loading">
                <div class="spinner"></div>
                <p>Preparando reintento de pago...</p>
            </div>
        `);

        const pending = JSON.parse(localStorage.getItem('pendingPayment'));
        if (!pending) throw new Error("No hay información de pago pendiente");

        if (!pending.serviceId || !pending.seats || !pending.token) {
            throw new Error("Información de pago incompleta");
        }

        currentServiceId = pending.serviceId;
        selectedSeats = pending.seats;
        jwtToken = pending.token;
        const emailCliente = pending.cliente;

        await obtenerToken();
        const amount = getTotalPrice();
        if (amount <= 0) throw new Error("Monto inválido para el pago");

        const orderId = generarIdUnico();

        const res = await fetch('/.netlify/functions/crearPago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                orderId,
                urlReturn: `${window.location.origin}/.netlify/functions/serveReturn`,
                urlConfirmation: 'http://sandbox.dev-wit.com/api/paymentConfirmation',
                email: emailCliente || ''
            })
        });

        const data = await res.json();
        if (!res.ok || !data.url || !data.flowData?.token) {
            throw new Error("Error creando pago o token ausente");
        }

        localStorage.setItem('currentPayment', JSON.stringify({
            orderId,
            token: data.flowData.token,
            amount,
            timestamp: Date.now()
        }));

        const paymentTab = window.open(data.url, '_blank');
        if (!paymentTab) throw new Error("Popup bloqueado por el navegador");

        let intentos = 0;
        const maxIntentos = 30;

        if (pollingActivo) {
            console.warn("Ya hay polling activo, se cancela nuevo.");
            return;
        }

        pollingActivo = true;
        clearInterval(pollingInterval);
        pollingInterval = setInterval(async () => {
            intentos++;
            try {
                if (document.visibilityState === 'visible') {
                    const estadoRes = await fetch('/.netlify/functions/consultarPago', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId, token: data.flowData.token })
                    });

                    const resultado = await estadoRes.json();

                    if (resultado.status === 2) {
                        clearInterval(pollingInterval);
                        pollingActivo = false;
                        if (paymentTab && !paymentTab.closed) paymentTab.close();

                        let processed = 0;
                        let errores = 0;

                        selectedSeats.forEach(s => {
                            $.ajax({
                                url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
                                method: 'POST',
                                headers: {
                                    Authorization: jwtToken,
                                    'Content-Type': 'application/json'
                                },
                                data: JSON.stringify({
                                    seatNumber: s.seat,
                                    authCode: 'AUTHWEB123',
                                    userId: user?.email || 'desconocido'
                                }),
                                success: () => {
                                    $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('reserved').off('click');
                                    processed++;
                                    if (processed === selectedSeats.length) {
                                        if (errores === 0) {
                                            registrarMovimientoWeb(resultado);
                                        } else {
                                            showPaymentResult($modal, false);
                                        }
                                    }
                                },
                                error: () => {
                                    processed++;
                                    errores++;
                                    if (processed === selectedSeats.length) {
                                        showPaymentResult($modal, false);
                                    }
                                }
                            });
                        });

                        function registrarMovimientoWeb(pagoInfo) {
                            const movimiento = {
                                caja: idCaja,
                                tipo: 'ingreso',
                                medioPago: 'tarjeta',
                                monto: amount,
                                servicioId: currentServiceId,
                                origen: currentServiceData?.origin || $('#origin').val(),
                                destino: currentServiceData?.destination || $('#destination').val(),
                                horaSalida: currentServiceData?.departureTime || '--:--',
                                cliente: emailCliente,
                                descripcion: `Venta de pasajes servicio ${currentServiceId}`,
                                fecha: new Date().toISOString(),
                                usuario: user.email,
                                nroTransaccion: orderId,
                                asientos: selectedSeats.map(s => ({
                                    seat: s.seat,
                                    floor: s.floor,
                                    price: s.price
                                })),
                                datosPago: {
                                    metodo: 'web',
                                    tokenFlow: pagoInfo.token,
                                    idPago: pagoInfo.flowOrderId || pagoInfo.orderId
                                }
                            };

                            fetch('https://boletos.dev-wit.com/api/movimientos', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(movimiento)
                            })
                                .then(res => res.json())
                                .then(data => {
                                    console.log('Pago registrado');
                                    generarBoleta(movimiento);
                                    showPaymentResult($modal, true);
                                    resetTravelSummary();
                                })
                                .catch(err => {
                                    console.error('Error al registrar el pago:', err);
                                    showPaymentResult($modal, false);
                                });
                        }
                    } else if ([3, 4].includes(resultado.status)) {
                        clearInterval(pollingInterval);
                        pollingActivo = false;
                        handlePaymentResult(false, {
                            status: resultado.status,
                            message: obtenerMensajeErrorFlow(resultado.status),
                            orderId
                        });
                        localStorage.removeItem('pendingPayment');
                        localStorage.removeItem('currentPayment');
                    } else {
                        clearInterval(pollingInterval);
                        pollingActivo = false;
                        handlePaymentResult(false, {
                            status: resultado.status,
                            message: 'Estado de pago desconocido. Intente nuevamente.',
                            orderId
                        });
                        localStorage.removeItem('pendingPayment');
                        localStorage.removeItem('currentPayment');
                    }

                    if (intentos >= maxIntentos) {
                        pollingActivo = false;
                        clearInterval(pollingInterval);
                        handlePaymentResult(false, {
                            message: "Tiempo de espera agotado",
                            orderId
                        });
                        localStorage.removeItem('pendingPayment');
                        localStorage.removeItem('currentPayment');
                    }
                }
            } catch (err) {
                clearInterval(pollingInterval);
                pollingActivo = false;
                console.error("Error en polling:", err);
                handlePaymentResult(false, {
                    message: "Error al verificar el estado del pago",
                    orderId
                });
                localStorage.removeItem('pendingPayment');
                localStorage.removeItem('currentPayment');
            }
        }, 2000);
    } catch (error) {
        console.error("Error en reintento de pago:", error);
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <h4>Error al reintentar pago</h4>
                <p>${error.message}</p>
                <button class="btn btn-secondary btn-close-modal">Volver</button>
            </div>
        `);
    } finally {
        $btn.prop('disabled', false).text('Reintentar Pago');
    }
});

/*===============================================================
|-----------------------  CANCELAR PAGO  -----------------------|
=================================================================*/

$(document).on('click', '.btn-cancel-payment', async function () {
    console.log("cancelado");

    await obtenerToken();

    if (!jwtToken) {
        alert("Error al generar el token. Por favor, reinicia la página.");
        return;
    }

    const promises = selectedSeats.map(s =>
        $.ajax({
            url: 'https://boletos.dev-wit.com/api/services/revert-seat',
            method: 'PATCH',
            headers: {
                Authorization: jwtToken,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                serviceId: currentServiceId,
                seatNumber: String(s.seat)
            }),
            success: () => {
                $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('available');
            },
            error: () => {
                console.error(`Error al liberar el asiento ${s.seat}`);
            }
        })
    );
    localStorage.removeItem('pendingPayment');
    localStorage.removeItem('currentPayment');
    // Esperar que todas las solicitudes terminen
    await Promise.all(promises);

    selectedSeats = [];
    updateTicketDetails();
});

/*===============================================================
|--------------------------  INTERFAZ  --------------------------|
=================================================================*/

let pagoEnProceso = false;

function handlePaymentResult(success, info) {
    const $modal = $('#paymentModal');
    if (!success) {
        let errorContent = `
            <div class="payment-error">
                <h4>Pago no completado</h4>
                <p>${info.message || 'No se pudo completar el pago.'}</p>
        `;
        if (info.isWebPayment) {
            errorContent += `
                <div class="d-flex gap-2 mt-3">
                    <button class="btn btn-primary btn-retry-payment">Reintentar Pago</button>
                    <button class="btn btn-secondary btn-close-modal">Volver</button>
                </div>
            `;
        } else {
            errorContent += `
                <button class="btn btn-secondary btn-close-modal mt-3">Volver</button>
            `;
        }

        errorContent += `</div>`;
        $modal.find('.modal-body').html(errorContent);
    }
}

function showPaymentResult($modal, isSuccess) {
    if (isSuccess) {
        $modal.find('.modal-body').html(`
            <div class="payment-success">
                <i class="fas fa-check-circle success-icon"></i>
                <h3>¡Pago exitoso!</h3>
                <p>Los asientos han sido reservados correctamente.</p>
                <p>Recibirás un correo con los detalles de tu compra.</p>
                <button class="btn btn-primary btn-close-modal">Aceptar</button>
            </div>
        `);

        resetTravelSummary();
    } else {
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <i class="fas fa-times-circle error-icon"></i>
                <h3>Error en el pago</h3>
                <p>No se pudo completar el proceso de pago.</p>
                <button class="btn btn-secondary btn-close-modal">Volver</button>
            </div>
        `);
    }
}

async function generarBoleta(movimiento) {
    const res = await fetch('/.netlify/functions/generarBoleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movimiento)
    });

    const data = await res.json();
    console.log(data.printDataBase64);
}

function resetTravelSummary() {
    // Limpiar asientos seleccionados
    selectedSeats = [];

    // Resetear la interfaz
    $('#ticketDetails').empty().hide();
    $('#selected-seats').empty();
    $('#total-price').text('$0');

    $('.seat.selected').removeClass('selected').addClass('reserved').off('click');
    $('.seccion2').removeClass('active')

    $('#origen').text('');
    $('#destino').text('');
    $('#fecha').text('');
    $('#hora-ida').text('');
    $('#hora-llegada').text('');
    $('#bus-plate').text('No disponible');
    $('#bus-type').text('No disponible');
    $('#bus-company').text('No disponible');

    //$('#searchForm')[0].reset();
    $('#serviceList').empty();
    $('.contenido-seccion').removeClass('active');
}
// Inicializar los botones de pago al cargar la página
initPaymentButtons();