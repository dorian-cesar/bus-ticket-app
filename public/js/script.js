function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch (e) {
        return true;
    }
}

async function logout() {
    localStorage.removeItem('tokenSesion');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

const loginToken = localStorage.getItem('tokenSesion');

if (isTokenExpired(loginToken)) {
    localStorage.removeItem('tokenSesion');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
} else {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        console.log("nombre: ",user.name);
        console.log("correo: ",user.email);
        console.log("rol: ", user.role);
    }
}

let jwtToken = null;

let currentServiceId = '';
let selectedSeats = [];
let currentServiceData = null;

let urlBase = window.location.origin;


async function obtenerToken() {
    const res = await fetch('/.netlify/functions/generarToken');
    const data = await res.json();
    jwtToken = data.token;
}

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

        const now = new Date();
        const todayString = now.toISOString().split('T')[0];

        const serviciosValidos = data.filter(service => {
            // Si la fecha no es hoy, se muestra el servicio sin importar la hora
            if (service.date !== todayString) return true;

            // Si es hoy, se construye un Date con la hora de salida
            const [hour, minute] = service.departureTime.split(':').map(Number);
            const departureDateTime = new Date(`${service.date}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);

            return departureDateTime > now;
        });

        if (serviciosValidos.length === 0) {
            $('#serviceList').append('<li class="list-group-item"><div class="info-servicio">No hay servicios disponibles</div></li>');
            return;
        }

        serviciosValidos.forEach(service => {
            $('#serviceList').append(`
                <li class="list-group-item service-list-item" data-service-id="${service.id}">
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

        console.log("currentServiceData:", currentServiceData);

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
            const layout = currentServiceData.seatLayout;

            console.log("Service layout:", layout);


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

function getTotalPrice() {
    return selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
}

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

$(document).on('click', '.seat.available, .seat.selected', async function () {

    const seat = String($(this).data('seat'));
    const floor = $(this).data('floor');
    const index = selectedSeats.findIndex(s => s.seat === seat);
    await obtenerToken();

    if (!jwtToken) {
        alert("error al generar el token, por favor reinicia la página");
        return;
    }

    if ($(this).hasClass('selected')) {
        // Liberar asiento
        $.ajax({
            url: 'https://boletos.dev-wit.com/api/services/revert-seat',
            method: 'PATCH',
            headers: {
                Authorization: jwtToken,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                serviceId: currentServiceId,
                seatNumber: String(seat)
            }),
            success: () => {
                $(this).removeClass('selected').addClass('available');
                selectedSeats.splice(index, 1);
                updateTicketDetails();
            },
            error: () => {
                alert('Error al liberar el asiento');
            }
        });
    } else {
        // Reservar asiento
        $.ajax({
            url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/reserve`,
            method: 'POST',
            headers: {
                Authorization: jwtToken,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({ seatNumber: String(seat), userId: 'usuario123' }),
            success: () => {
                $(this).removeClass('available').addClass('selected');
                const price = floor === 1 ? currentServiceData.priceFirst : currentServiceData.priceSecond;
                selectedSeats.push({ seat, floor, price });
                updateTicketDetails();
            },
            error: () => {
                alert('El asiento ha sido ocupado');
                const $serviceBtn = $(`.selectServiceBtn[data-id="${currentServiceId}"]`);
                if ($serviceBtn.length) {
                    $serviceBtn.trigger('click');
                }
            }
        });
    }
});

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

//modal--------------------------------------------------------------------------------------------------------------------------------

// Mostrar modal con animación
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

function generarIdUnico() {
    return 'orden_' + Date.now();
}

// Función para inicializar los eventos de pago
function initPaymentButtons() {
    $(document).off('click', '#payWeb, #payCash').on('click', '#payWeb, #payCash', handlePayment);
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

// Función principal de manejo de pagos
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

    if (method === 'web') {
        try {
            const amount = getTotalPrice();
            const orderId = generarIdUnico();

            if (amount <= 0) {
                throw new Error("Monto inválido para el pago");
            }

            // Guardar estado actual para posibles reintentos
            localStorage.setItem('pendingPayment', JSON.stringify({
                serviceId: currentServiceId,
                seats: selectedSeats,
                token: jwtToken
            }));

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

            const data = await res.json();

            if (!data.url) {
                throw new Error("No se recibió URL de pago");
            }

            // Abrir ventana de pago
            const paymentWindow = window.open(
                data.url,
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

        } catch (error) {
            console.error("Error en pago web:", error);
            $modal.find('.modal-body').html(`
                <div class="payment-error">
                    <h4>Error al iniciar pago</h4>
                    <p>${error.message}</p>
                    ${error.message === "Popup bloqueado" ?
                    `<button class="btn btn-primary" onclick="window.open('${data?.url}', 'flowPayment')">
                            Abrir Pago Manualmente
                        </button>` : ''}
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
                    <div class="cash-actions mt-3">
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
}

function handlePaymentWindowClosed() {
    const $modal = $('#paymentModal');
    $modal.find('.modal-body').html(`
        <div class="payment-warning">
            <h4>Ventana de pago cerrada</h4>
            <p>¿Deseas intentar nuevamente?</p>
            <button class="btn btn-primary btn-retry-payment">Reintentar Pago</button>
            <button class="btn btn-secondary btn-cancel-payment btn-close-modal">Cancelar</button>
        </div>
    `);
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
                <button class="btn btn-primary btn-retry-payment">Reintentar Pago</button>
                <button class="btn btn-secondary btn-cancel-payment btn-close-modal">Cancelar y Liberar Asientos</button>
            </div>
        `);
    }
}

$(document).on('click', '.btn-retry-payment', retryPayment);

async function retryPayment() {
    const $modal = $('#paymentModal');

    // Mostrar estado de carga
    $modal.find('.modal-body').html(`
        <div class="payment-loading">
            <div class="spinner"></div>
            <p>Preparando reintento de pago...</p>
        </div>
    `);

    try {
        // Obtener datos del pago pendiente del localStorage
        const pending = JSON.parse(localStorage.getItem('pendingPayment'));
        if (!pending) {
            throw new Error("No hay información de pago pendiente");
        }

        // Verificar que tenemos todos los datos necesarios
        if (!pending.serviceId || !pending.seats || !pending.token) {
            throw new Error("Información de pago incompleta");
        }

        // Actualizar variables globales con los datos del pago pendiente
        currentServiceId = pending.serviceId;
        selectedSeats = pending.seats;
        jwtToken = pending.token;

        // Verificar que el token sigue siendo válido
        await obtenerToken();

        // Calcular el monto total
        const amount = getTotalPrice();
        if (amount <= 0) {
            throw new Error("Monto inválido para el pago");
        }

        // Generar un nuevo orderId para el reintento
        const orderId = generarIdUnico();

        // Crear nueva solicitud de pago
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

        const data = await res.json();

        if (!data.url) {
            throw new Error("No se recibió URL de pago");
        }

        // Abrir nueva ventana de pago
        const paymentWindow = window.open(
            data.url,
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

    } catch (error) {
        console.error("Error en reintento de pago:", error);
        $modal.find('.modal-body').html(`
            <div class="payment-error">
                <h4>Error al reintentar pago</h4>
                <p>${error.message}</p>
                <button class="btn btn-secondary btn-close-modal">Volver</button>
            </div>
        `);
    }
}

async function revertAndClose() {
    await revertSeats();
    hideModal();
}

$(document).on('click', '.btn-cancel-payment', cancelPayment);


async function cancelPayment() {
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

    // Esperar que todas las solicitudes terminen
    await Promise.all(promises);

    selectedSeats = [];
    updateTicketDetails();
}



$(document).on('click', '.btn-confirm-cash', async function () {
    const $modal = $('#paymentModal');
    const amount = getTotalPrice();
    const orderId = generarIdUnico();

    let processed = 0;

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
                userId: 'usuario123'
            }),
            success: () => {
                $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('reserved').off('click');
                processed++;

                // Solo cuando se confirmen todos los asientos
                if (processed === selectedSeats.length) {

                    fetch('/.netlify/functions/registrarPago', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            servicioId: currentServiceId,
                            usuario: 'usuario123',
                            fecha: new Date().toISOString(),
                            metodoPago: 'efectivo',
                            monto: amount,
                            orden: orderId,
                            asientos: selectedSeats
                        })
                    })
                        .then(res => res.json())
                        .then(data => {
                            console.log('Pago registrado:', data);
                            showPaymentResult($modal, true);
                            localStorage.removeItem('pendingPayment');
                        })
                        .catch(err => {
                            console.error('Error al registrar el pago:', err);
                            showPaymentResult($modal, false);
                        });
                }
            },
            error: () => {
                processed++;
                if (processed === selectedSeats.length) {
                    showPaymentResult($modal, false);
                }
            }
        });
    });
});



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
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});


// Función para mostrar el resultado del pago
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

function resetTravelSummary() {
    // Limpiar asientos seleccionados
    selectedSeats = [];

    // Resetear la interfaz
    $('#ticketDetails').empty().hide();
    $('#selected-seats').empty();
    $('#total-price').text('$0');

    $('.seat.selected').removeClass('selected').addClass('reserved').off('click');
    $('.seccion2').removeClass('active')

    $('#origen').text('-----');
    $('#destino').text('-----');
    $('#fecha').text('');
    $('#hora-ida').text('--:--');
    $('#hora-llegada').text('--:--');
    $('#bus-plate').text('No disponible');
    $('#bus-type').text('No disponible');
    $('#bus-company').text('No disponible');

    $('#searchForm')[0].reset();
    $('#serviceList').empty();
    $('.contenido-seccion').removeClass('active');
}
// Inicializar los botones de pago al cargar la página
initPaymentButtons();

setInterval(() => {
    const token = localStorage.getItem('tokenSesion');

    if (!token || isTokenExpired(token)) {
        alert('Tu sesión ha expirado. Por favor vuelve a iniciar sesión.');
        localStorage.removeItem('tokenSesion');
        window.location.href = '/index.html';
    }
}, 30000); // cada 30 segundos



window.addEventListener('pageshow', () => {
    const token = localStorage.getItem('tokenSesion');
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem('tokenSesion');
        window.location.href = '/index.html';
    }
});
