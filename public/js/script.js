

console.log("script cargado");

let jwtToken = null;

let currentServiceId = '';
let selectedSeats = [];
let currentServiceData = null;

let urlBase = window.location.origin;

//----------------------------------------------funciones reutilizables----------------------------------------------
function generarIdUnico() {
    return 'orden_' + Date.now();
}

function getTotalPrice() {
    return selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
}

function obtenerMensajeErrorFlow(codigo) {
    if (!codigo) return "❌ Error desconocido en el proceso de pago";

    const code = Number(codigo);
    const errores = {
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


//----------------------------------------------funciones de token y reserva----------------------------------------------
async function obtenerToken() {
    const res = await fetch('/.netlify/functions/generarToken');
    const data = await res.json();
    jwtToken = data.token;
}

async function reserveSelectedSeats() {
    try {
        // Verificar que tenemos los datos necesarios
        if (!currentServiceId || selectedSeats.length === 0 || !jwtToken) {
            throw new Error("Datos incompletos para reservar asientos");
        }

        // Verificar disponibilidad primero
        const seatStatusData = await $.get(`https://boletos.dev-wit.com/api/seats/${currentServiceId}`);
        const seatStatusMap = {};
        seatStatusData.forEach(seat => {
            seatStatusMap[seat.number] = seat.status;
        });

        const unavailableSeats = selectedSeats.filter(seat => 
            seatStatusMap[seat.seat] !== 'available'
        );

        if (unavailableSeats.length > 0) {
            throw new Error(`Los siguientes asientos ya no están disponibles: ${
                unavailableSeats.map(s => s.seat).join(', ')
            }`);
        }

        // Reservar cada asiento
        const results = await Promise.all(
            selectedSeats.map(seat => 
                $.ajax({
                    url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/reserve`,
                    method: 'POST',
                    headers: {
                        Authorization: jwtToken,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        seatNumber: String(seat.seat),
                        userId: 'usuario123'
                    })
                })
            )
        );

        return { success: true };
    } catch (error) {
        console.error("Error al reservar asientos:", error);
        return {
            success: false,
            message: error.responseJSON?.message || 
                   error.message || 
                   "Error al reservar asientos. Intente nuevamente."
        };
    }
}

async function revertSuccessfulReservations(successfulReservations) {
    if (successfulReservations.length === 0) return;

    try {
        await Promise.all(
            successfulReservations.map(res => {
                return $.ajax({
                    url: 'https://boletos.dev-wit.com/api/services/revert-seat',
                    method: 'PATCH',
                    headers: {
                        Authorization: jwtToken,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        serviceId: currentServiceId,
                        seatNumber: String(res.seat)
                    })
                });
            })
        );
    } catch (revertError) {
        console.error("Error al revertir reservas:", revertError);
    }
}

async function revertSeats() {
    try {
        await obtenerToken(); // Asegurarnos de tener un token válido

        // Revertir cada asiento seleccionado
        const revertPromises = selectedSeats.map(seat => {
            return $.ajax({
                url: 'https://boletos.dev-wit.com/api/services/revert-seat',
                method: 'PATCH',
                headers: {
                    Authorization: jwtToken,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    serviceId: currentServiceId,
                    seatNumber: String(seat.seat)
                })
            });
        });

        await Promise.all(revertPromises);

        // Actualizar UI
        selectedSeats.forEach(seat => {
            $(`[data-seat="${seat.seat}"]`)
                .removeClass('selected')
                .addClass('available')
                .off('click');
        });

        selectedSeats = [];
        updateTicketDetails();

        return true;
    } catch (error) {
        console.error("Error al revertir asientos:", error);
        return false;
    }
}

async function confirmSeatReservation() {
    try {
        const confirmPromises = selectedSeats.map(seat => {
            return $.ajax({
                url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
                method: 'POST',
                headers: {
                    Authorization: jwtToken,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    seatNumber: String(seat.seat),
                    userId: 'usuario123'
                })
            });
        });

        await Promise.all(confirmPromises);

        // Actualizar UI
        selectedSeats.forEach(seat => {
            $(`[data-seat="${seat.seat}"]`)
                .removeClass('selected')
                .addClass('reserved')
                .off('click');
        });

        return true;
    } catch (error) {
        console.error("Error al confirmar asientos:", error);
        throw new Error("Error al confirmar la reserva de asientos");
    }
}

async function verifySeatsAvailability() {
    try {
        const res = await $.get(`https://boletos.dev-wit.com/api/seats/${currentServiceId}`);
        const seatStatusMap = {};
        res.forEach(seat => {
            seatStatusMap[seat.number] = seat.status;
        });

        // Verificar que todos los asientos seleccionados sigan disponibles
        return selectedSeats.every(seat => {
            return seatStatusMap[seat.seat] === 'available';
        });
    } catch (error) {
        console.error("Error al verificar asientos:", error);
        return false;
    }
}

//----------------------------------------------funciones de pago----------------------------------------------

async function createPaymentOrder(amount, orderId) {
    const res = await fetch('/.netlify/functions/crearPago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount,
            orderId,
            urlReturn: `${window.location.origin}/return.html`,
            urlConfirmation: `${window.location.origin}/.netlify/functions/flowCallback`
        })
    });

    if (!res.ok) {
        throw new Error("Error al crear orden de pago");
    }

    return await res.json();
}

function openPaymentWindow(url, $modal) {
    const paymentWindow = window.open(
        url,
        'flowPayment',
        'width=800,height=600,scrollbars=yes,resizable=yes'
    );

    if (!paymentWindow) {
        throw new Error("Popup bloqueado");
    }

    // Configurar temporizador para verificar si la ventana se cerró sin completar
    const checkWindowClosed = setInterval(() => {
        if (paymentWindow.closed) {
            clearInterval(checkWindowClosed);
            handlePaymentWindowClosed();
        }
    }, 1000);

    // Escuchar mensaje desde return.html
    const messageHandler = (event) => {
        if (event.data?.tipo === 'pagoCompletado') {
            clearInterval(checkWindowClosed);
            window.removeEventListener('message', messageHandler);
            handlePaymentResult(event.data.success, event.data.status);
        }
    };

    window.addEventListener('message', messageHandler);
}

function handlePaymentWindowClosed() {
    const $modal = $('#paymentModal');
    $modal.find('.modal-body').html(`
        <div class="payment-warning">
            <h4>Ventana de pago cerrada</h4>
            <p>¿Deseas intentar nuevamente?</p>
            <button class="btn btn-primary" onclick="retryPayment()">Reintentar Pago</button>
            <button class="btn btn-secondary" onclick="revertAndClose()">Cancelar y Liberar Asientos</button>
        </div>
    `);
}

function showPaymentError($modal, error) {
    const pending = localStorage.getItem('pendingPayment');
    const allowRetry = pending && !error.message.includes("tiempo de reserva");

    $modal.find('.modal-body').html(`
        <div class="payment-error">
            <i class="fas fa-times-circle error-icon"></i>
            <h3>Error en el pago</h3>
            <p>${error.message}</p>
            <div class="error-actions">
                ${allowRetry ?
            '<button class="btn btn-primary" onclick="retryPayment()">Reintentar Pago</button>' :
            ''
        }
                <button class="btn btn-secondary" onclick="${pending ? 'cancelPayment()' : 'hideModal()'}">
                    ${pending ? 'Cancelar y liberar asientos' : 'Cerrar'}
                </button>
            </div>
        </div>
    `);
}

function showPaymentResult($modal, isSuccess, statusCode = null) {
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
        const errorMessage = obtenerMensajeErrorFlow(statusCode) || "Error desconocido en el pago";
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <i class="fas fa-times-circle error-icon"></i>
                <h3>Error en el pago</h3>
                <p>${errorMessage}</p>
                <div class="error-actions">
                    <button class="btn btn-primary" onclick="retryPayment()">Reintentar Pago</button>
                    <button class="btn btn-secondary btn-close-modal">Cancelar</button>
                </div>
            </div>
        `);
    }
}

async function handlePaymentResult(success, statusCode = null) {
    const $modal = $('#paymentModal');

    if (success) {
        try {
            // Confirmar reserva de asientos
            await confirmSeatReservation();

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
            localStorage.removeItem('pendingPayment');
        } catch (error) {
            showPaymentError($modal, error);
        }
    } else {
        const errorMessage = obtenerMensajeErrorFlow(statusCode) || "Error desconocido en el pago";
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <i class="fas fa-times-circle error-icon"></i>
                <h3>Error en el pago</h3>
                <p>${errorMessage}</p>
                <div class="error-actions">
                    <button class="btn btn-primary" onclick="retryPayment()">Reintentar Pago</button>
                    <button class="btn btn-secondary" onclick="cancelPayment()">Cancelar</button>
                </div>
            </div>
        `);
    }
}

async function revertAndClose() {
    await revertSeats();
    hideModal();
}

async function handlePayment() {
    const method = this.id === 'payWeb' ? 'web' : 'cash';
    const $modal = $('#paymentModal');

    // Mostrar estado de carga
    $modal.find('.modal-body').html(`
        <div class="payment-loading">
            <div class="spinner"></div>
            <p>Preparando pago...</p>
        </div>
    `);

    try {
        // Validar que hay asientos seleccionados
        if (selectedSeats.length === 0) {
            throw new Error("Debes seleccionar al menos un asiento");
        }

        // Obtener token si no existe
        if (!jwtToken) {
            await obtenerToken();
            if (!jwtToken) {
                throw new Error("Error de autenticación");
            }
        }

        // Guardar estado para reintentos
        if (!localStorage.getItem('pendingPayment')) {
            localStorage.setItem('pendingPayment', JSON.stringify({
                serviceId: currentServiceId,
                seats: selectedSeats,
                token: jwtToken,
                timestamp: Date.now()
            }));
        }

        // Procesar según método de pago
        if (method === 'web') {
            await processWebPayment($modal);
        } else {
            await processCashPayment($modal);
        }
    } catch (error) {
        console.error("Error en handlePayment:", error);
        showPaymentError($modal, error);
    }
}

async function processWebPayment($modal) {
    const amount = getTotalPrice();
    const orderId = generarIdUnico();

    if (amount <= 0) {
        throw new Error("Monto inválido para el pago");
    }

    // Crear orden de pago
    const paymentResponse = await createPaymentOrder(amount, orderId);

    if (!paymentResponse.url) {
        throw new Error("No se recibió URL de pago");
    }

    // Abrir ventana de pago
    openPaymentWindow(paymentResponse.url, $modal);
}

async function processCashPayment($modal) {
    try {
        // 1. Primero reservar los asientos
        const reserveResult = await reserveSelectedSeats();
        if (!reserveResult.success) {
            throw new Error(reserveResult.message);
        }

        // 2. Mostrar estado de carga
        $modal.find('.modal-body').html(`
            <div class="payment-loading">
                <div class="spinner"></div>
                <p>Confirmando reserva en efectivo...</p>
            </div>
        `);

        // 3. Confirmar cada asiento
        const authCode = 'AUTHCASH123';
        let processed = 0;
        const failedSeats = [];

        for (const seat of selectedSeats) {
            try {
                await $.ajax({
                    url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
                    method: 'POST',
                    headers: {
                        Authorization: jwtToken,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        seatNumber: seat.seat,
                        authCode: authCode,
                        userId: 'usuario123'
                    })
                });

                // Actualizar UI si se confirma
                $(`[data-seat="${seat.seat}"]`)
                    .removeClass('selected')
                    .addClass('reserved')
                    .off('click');
                
                processed++;
            } catch (error) {
                console.error(`Error al confirmar asiento ${seat.seat}:`, error);
                failedSeats.push(seat.seat);
                
                // Intentar liberar el asiento fallido
                try {
                    await $.ajax({
                        url: 'https://boletos.dev-wit.com/api/services/revert-seat',
                        method: 'PATCH',
                        headers: {
                            Authorization: jwtToken,
                            'Content-Type': 'application/json'
                        },
                        data: JSON.stringify({
                            serviceId: currentServiceId,
                            seatNumber: String(seat.seat)
                        })
                    });
                    
                    $(`[data-seat="${seat.seat}"]`)
                        .removeClass('selected')
                        .addClass('available');
                } catch (revertError) {
                    console.error(`Error al liberar asiento ${seat.seat}:`, revertError);
                }
            }
        }

        // 4. Manejar resultados
        if (failedSeats.length === 0) {
            // Todos los asientos se confirmaron correctamente
            showPaymentResult($modal, true);
            localStorage.removeItem('pendingPayment');
        } else {
            // Algunos asientos fallaron
            selectedSeats = selectedSeats.filter(seat => !failedSeats.includes(seat.seat));
            updateTicketDetails();
            
            $modal.find('.modal-body').html(`
                <div class="payment-warning">
                    <i class="fas fa-exclamation-triangle warning-icon"></i>
                    <h3>Pago parcialmente completado</h3>
                    <p>Los siguientes asientos no pudieron confirmarse: ${failedSeats.join(', ')}</p>
                    <p>Los asientos fallidos han sido liberados.</p>
                    <button class="btn btn-primary btn-close-modal">Aceptar</button>
                </div>
            `);
        }
    } catch (error) {
        console.error("Error en pago en efectivo:", error);
        showPaymentError($modal, error);
    }
}


//----------------------------------------------reintento de pago----------------------------------------------

window.retryPayment = async function () {
    const $modal = $('#paymentModal');
    const pending = JSON.parse(localStorage.getItem('pendingPayment'));

    try {
        // Verificar que hay un pago pendiente
        if (!pending) {
            throw new Error("No hay pago pendiente para reintentar");
        }

        // Verificar que no haya expirado el tiempo (15 minutos)
        const reservationTime = Date.now() - pending.timestamp;
        if (reservationTime > 15 * 60 * 1000) {
            await revertSeats();
            localStorage.removeItem('pendingPayment');
            throw new Error("El tiempo de reserva ha expirado. Por favor selecciona los asientos nuevamente.");
        }

        // Restaurar estado
        currentServiceId = pending.serviceId;
        selectedSeats = pending.seats;
        jwtToken = pending.token;

        // Mostrar carga
        $modal.find('.modal-body').html(`
            <div class="payment-loading">
                <div class="spinner"></div>
                <p>Preparando reintento de pago...</p>
            </div>
        `);

        // Volver a intentar el pago web
        $('#payWeb').click();

    } catch (error) {
        console.error("Error en reintento:", error);
        showPaymentError($modal, error);
    }
};

window.cancelPayment = async function () {
    try {
        // Liberar asientos
        await revertSeats();

        // Limpiar estado de pago pendiente
        localStorage.removeItem('pendingPayment');

        // Resetear selección visual
        selectedSeats.forEach(seat => {
            $(`[data-seat="${seat.seat}"]`)
                .removeClass('selected')
                .addClass('available');
        });

        selectedSeats = [];
        updateTicketDetails();
        hideModal();

    } catch (error) {
        console.error("Error al cancelar pago:", error);
        alert("Error al liberar asientos. Por favor recarga la página.");
    }
};

//----------------------------------------------gestión del modal----------------------------------------------

function hideModal() {
    $('#paymentModal').fadeOut(300, function () {
        $(this).removeClass('show');
        document.body.style.overflow = '';
    });
}

//----------------------------------------------gestión de asientos----------------------------------------------

$(document).on('click', '.seat.available, .seat.selected', async function () {
    const seat = String($(this).data('seat'));
    const floor = $(this).data('floor');
    const index = selectedSeats.findIndex(s => s.seat === seat);

    if ($(this).hasClass('selected')) {
        // Solo permitir liberar si no hay pago pendiente
        if (!localStorage.getItem('pendingPayment')) {
            await obtenerToken();
            if (!jwtToken) {
                alert("Error al generar el token, por favor reinicia la página");
                return;
            }

            await revertSeats();
            $(this).removeClass('selected').addClass('available');
            selectedSeats.splice(index, 1);
            updateTicketDetails();
        } else {
            alert("No puedes liberar asientos durante un proceso de pago. Cancela el pago primero.");
        }
    } else {
        // Solo seleccionar visualmente
        $(this).removeClass('available').addClass('selected');
        const price = floor === 1 ? currentServiceData.priceFirst : currentServiceData.priceSecond;
        selectedSeats.push({ seat, floor, price });
        updateTicketDetails();
    }
});

async function liberarAsiento(seat) {
    return $.ajax({
        url: 'https://boletos.dev-wit.com/api/services/revert-seat',
        method: 'PATCH',
        headers: {
            Authorization: jwtToken,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            serviceId: currentServiceId,
            seatNumber: String(seat)
        })
    });
}

async function reservarAsientosTemporalmente() {
    try {
        const results = await Promise.all(
            selectedSeats.map(seat =>
                $.ajax({
                    url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/reserve`,
                    method: 'POST',
                    headers: {
                        Authorization: jwtToken,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        seatNumber: String(seat.seat),
                        userId: 'usuario123',
                        temporary: true // Indica que es una reserva temporal
                    })
                })
            )
        );

        // Guardar información para posible reintento
        localStorage.setItem('pendingPayment', JSON.stringify({
            serviceId: currentServiceId,
            seats: selectedSeats,
            token: jwtToken,
            reservedAt: Date.now()
        }));

        return { success: true };
    } catch (error) {
        console.error("Error al reservar asientos:", error);
        return {
            success: false,
            message: "Error al reservar asientos. Intente nuevamente."
        };
    }
}

async function verificarDisponibilidadAsientos() {
    try {
        const response = await $.get(`https://boletos.dev-wit.com/api/seats/${currentServiceId}`);
        const seatStatus = {};
        response.forEach(seat => {
            seatStatus[seat.number] = seat.status;
        });

        const pending = JSON.parse(localStorage.getItem('pendingPayment'));
        const unavailableSeats = pending.seats.filter(seat =>
            seatStatus[seat.seat] !== 'available' &&
            seatStatus[seat.seat] !== 'temporary_reserved'
        );

        return {
            available: unavailableSeats.length === 0,
            unavailableSeats: unavailableSeats.map(s => s.seat)
        };
    } catch (error) {
        console.error("Error al verificar asientos:", error);
        return { available: false, unavailableSeats: [] };
    }
}

async function liberarAsientosPendientes() {
    const pending = JSON.parse(localStorage.getItem('pendingPayment'));
    if (!pending) return;

    await Promise.all(
        pending.seats.map(seat =>
            liberarAsiento(seat.seat).catch(e => console.error(e))
        )
    );
}

//----------------------------------------------busqueda de servicios----------------------------------------------

$(document).ready(function () {
    $('.seccion1').addClass('active');

    $.get('https://boletos.dev-wit.com/api/routes/origins', function (data) {
        data.forEach(route => {
            $('#origin').append(`<option value="${route.origen}">${route.origen}</option>`);
        });

        $('#origin').on('change', function () {
            const selectedOrigin = $(this).val();
            const destinos = data.find(r => r.origen === selectedOrigin)?.destinos || [];
            destinos.forEach(dest => {
                $('#destination').append(`<option value="${dest}">${dest}</option>`);
            });
        });
    });
});

$('#searchForm').on('submit', function (e) {
    e.preventDefault();
    const origin = $('#origin').val();
    const destination = $('#destination').val();
    const date = $('#date').val();

    const originText = $('#origin option:selected').text();
    const destinationText = $('#destination option:selected').text();
    const formattedDate = date;

    updateTravelSummary(originText, destinationText, formattedDate, null, null);

    $('#serviceList').empty().append(`
        <li class="list-group-item loading" style="height: 100px;"></li>
        <li class="list-group-item loading" style="height: 100px;"></li>
    `);

    $.get(`https://boletos.dev-wit.com/api/services?origin=${origin}&destination=${destination}&date=${date}`, function (data) {
        $('#serviceList').empty();
        if (data.length === 0) {
            $('#serviceList').append('<li class="list-group-item"><div class="info-servicio">No hay servicios disponibles</div></li>');
            return;
        }

        data.forEach(service => {
            $('#serviceList').append(`
                <li class="list-group-item service-list-item" data-service-id="${service.id}"">
                    <div class="contenido-item">
                        <div class="contenido-servicio">
                            <div class="header-servicio">
                            ${service.company} (${service.busTypeDescription}) <strong>${service.departureTime}</strong> - <strong>${service.arrivalTime}</strong> 

                            </div>
                            <div class="info-servicio">
                                    <div class="info1">
                                    <strong>${service.availableSeats}</strong> Asientos Disponibles
                                    
                                </div>
                                <div class="info2">
                                    <div><strong>Piso 1: </strong><br>${service.seatDescriptionFirst} - <strong>$${service.priceFirst}</strong></div>
                                    <div><strong>Piso 2: </strong><br>${service.seatDescriptionSecond} - <strong>$${service.priceSecond}</strong></div>
                                </div>
                            </div>
                        </div>
                        <div class="button-servicio">
                            <button class="btn selectServiceBtn btn-primary" data-id="${service.id}">Ver Asientos</button>
                        </div>
                    </div>
                </li>
            `);
        });
    }).fail(() => {
        $('#serviceList').empty().append('<li class="list-group-item">Error al cargar servicios</li>');
    });
});

$(document).on('click', '.selectServiceBtn', function () {
    const serviceId = $(this).data('id');
    currentServiceId = serviceId;
    selectedSeats = [];

    $('.service-list-item').removeClass('selected');
    $(this).closest('.service-list-item').addClass('selected');

    $('#selected-seats').empty();
    $('#total-price').text('$0');

    $('.contenido-seccion').removeClass('active');
    $('#seatLayout').empty().append(`
        <div class="loading" style="height: 300px; width: 100%;"></div>
    `);
    $('#ticketDetails').empty().hide();
    $('.seccion2').addClass('active');

    $.get(`https://boletos.dev-wit.com/api/services?origin=${$('#origin').val()}&destination=${$('#destination').val()}&date=${$('#date').val()}`, function (data) {
        currentServiceData = data.find(s => s.id === serviceId);

        updateTravelSummary(
            $('#origin option:selected').text(),
            $('#destination option:selected').text(),
            $('#date').val(),
            currentServiceData.departureTime,
            currentServiceData.arrivalTime
        );


        $.get(`https://boletos.dev-wit.com/api/seats/${serviceId}`, function (seatStatusData) {
            $('#seatLayout').empty();
            const seatStatusMap = {};
            seatStatusData.forEach(seat => {
                seatStatusMap[seat.number] = seat;
            });

            const renderSeats = (floorName, seatMap, floor) => {
                $('#seatLayout').append(`<h4>${floorName}</h4>`);
                seatMap.forEach(row => {
                    const rowDiv = $('<div class="fila"></div>');
                    row.forEach(seat => {
                        if (seat === '') {
                            rowDiv.append('<div class="seat empty"></div>');
                        } else {
                            const status = seatStatusMap[seat]?.status;
                            const cls = status === 'available' ? 'available' : 'locked';
                            rowDiv.append(`<div class="seat ${cls}" data-seat="${seat}" data-floor="${floor}">${seat}</div>`);
                        }
                    });
                    $('#seatLayout').append(rowDiv);
                });
            };
            const layout = currentServiceData.layout;

            if (layout) {
                if (layout.floor1) renderSeats('Primer Piso', layout.floor1.seatMap, 1);
                if (layout.floor2) renderSeats('Segundo Piso', layout.floor2.seatMap, 2);
                if (layout.seatMap) renderSeats('Único Piso', layout.seatMap, 1);
            } else {
                $('#seatLayout').append('<div class="error">No hay plano de asientos disponible para este servicio.</div>');
            }

            $('.contenido-seccion').addClass('active');
        }).fail(() => {
            $('#seatLayout').empty().append('<div class="error">Error al cargar asientos</div>');
            $('.contenido-seccion').addClass('active');
        });
    }).fail(() => {
        $('#seatLayout').empty().append('<div class="error">Error al cargar servicio</div>');
        $('.contenido-seccion').addClass('active');
    });
});

function updateTravelSummary(origin, destination, date, departureTime, arrivalTime) {
    $('#origen').text(origin);
    $('#destino').text(destination);
    $('#fecha').text(date);
    $('#hora-ida').text(departureTime || '--:--');
    $('#hora-llegada').text(arrivalTime || '--:--');

    // También actualiza otros datos del bus si es necesario
    if (currentServiceData) {
        $('#bus-plate').text('No disponible');
        $('#bus-type').text(currentServiceData.busTypeDescription || 'No disponible');
        $('#bus-company').text(currentServiceData.company || 'No disponible');

        $('#total-price').text('$' + getTotalPrice());
    }

    $('.seccion3').addClass('active');
}

//----------------------------------------------modal de pago----------------------------------------------

$(document).on('click', '.btn-close, .btn-close-modal', hideModal);

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

$(document).on('click', '#openPaymentModal', function () {
    $('#paymentModal').fadeIn(300).addClass('show');
    document.body.style.overflow = 'hidden';
});

function initPaymentButtons() {
    $(document).off('click', '#payWeb, #payCash').on('click', '#payWeb, #payCash', handlePayment);
}

//----------------------------------------------reseteo de ui----------------------------------------------

function updateTicketDetails() {
    const $ticketDetails = $('#ticketDetails');

    if (selectedSeats.length === 0) {
        $ticketDetails.empty().hide();
        $('#total-price').text('$0');
        $('#selected-seats').empty();

        return;
    }

    $ticketDetails.show();

    let html = '<ul class="lista-asientos">';
    selectedSeats.forEach(s => {
        html += `<li class="lista-asientos-item">Asiento ${s.seat} (Piso ${s.floor}) <br> $${s.price}</li>`;
    });
    html += '</ul>';

    $ticketDetails.html(html).hide().fadeIn(300);

    $('#total-price').text('$' + getTotalPrice());

    $('#selected-seats').empty();
    selectedSeats.forEach(seat => {
        $('#selected-seats').append(`<span class="seat-number">${seat.seat}</span>`);
    });
    console.log(getTotalPrice())
}

function resetTravelSummary() {
    // Limpiar asientos seleccionados
    selectedSeats = [];

    // Resetear la interfaz
    $('#ticketDetails').empty().hide();
    $('#selected-seats').empty();
    $('#total-price').text('$0');

    // Resetear los asientos visualmente (cambiar reserved a available si es necesario)
    $('.seat.selected').removeClass('selected').addClass('reserved').off('click');
    $('.seccion2').removeClass('active')

    // Mantener la información del viaje (origen, destino, fecha) pero limpiar detalles específicos
    $('#origen').text('-----');
    $('#destino').text('-----');
    $('#fecha').text('----/--/--');
    $('#hora-ida').text('--:--');
    $('#hora-llegada').text('--:--');
    $('#bus-plate').text('No disponible');
    $('#bus-type').text('No disponible');
    $('#bus-company').text('No disponible');

    // Opcional: Si quieres limpiar completamente el formulario de búsqueda
    $('#searchForm')[0].reset();
    $('#serviceList').empty();
    $('.contenido-seccion').removeClass('active');
}

//----------------------------------------------DOM----------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const orderId = urlParams.get('orderId');

    if (paymentStatus === 'success' && orderId) {
        $('#paymentModal').html(`
        <div class="payment-success">
          <h4>¡Pago exitoso!</h4>
          <p>Orden #${orderId} confirmada. Recibirás un email con los detalles.</p>
          <button class="btn btn-primary btn-close-modal">Aceptar</button>
        </div>
      `).fadeIn();
    }
});

initPaymentButtons();