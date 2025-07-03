

console.log("script cargado");

let jwtToken = null;

let currentServiceId = '';
let selectedSeats = [];
let currentServiceData = null;

let urlBase = window.location.origin; // esto lo resuelve automáticamente


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

function generarIdUnico() {
    return 'orden_' + Date.now();
}

// Función para inicializar los eventos de pago
function initPaymentButtons() {
    $(document).off('click', '#payWeb, #payCash').on('click', '#payWeb, #payCash', handlePayment);
}

function obtenerMensajeErrorFlow(codigo) {
    switch (Number(codigo)) {
        case -1:
            return "❌ Tarjeta inválida";
        case -2:
            return "❌ Error de conexión con el medio de pago";
        case -3:
            return "❌ Excede el monto máximo permitido";
        case -4:
            return "❌ Fecha de expiración inválida";
        case -5:
            return "❌ Problema en la autenticación de la tarjeta";
        case -6:
            return "❌ Rechazo general de la transacción";
        case -7:
            return "❌ Tarjeta bloqueada";
        case -8:
            return "❌ Tarjeta vencida";
        case -9:
            return "❌ Transacción no soportada por el medio de pago";
        case -10:
            return "❌ Problema interno en la transacción";
        case -11:
            return "❌ Límite de reintentos de rechazos excedido";
        case 999:
            return "❌ Error desconocido en el proceso de pago";
        default:
            return "❌ Código de error no reconocido";
    }
}

// Función principal de manejo de pagos
async function handlePayment() {

    const method = this.id === 'payWeb' ? 'web' : 'cash';
    const authCode = method === 'web' ? 'AUTHWEB123' : 'AUTHCASH123';
    const $modal = $('#paymentModal');

    const originalModalContent = `
        <div class="modal-body">
            
            <button id="payWeb" class="btn btn-primary">Pago Web</button>
            <button id="payCash" class="btn btn-success">Pago en Efectivo</button>
            <button class="btn btn-secondary btn-close-modal">Cancelar</button>
        </div>
    `;

    // Mostrar estado de carga
    $modal.find('.modal-body').html('<div class="loading-payment">Procesando pago...</div>');


    if (this.id === 'payWeb') {
        try {
            const amount = getTotalPrice();
            const orderId = generarIdUnico();

            if (isNaN(amount) || Number(amount) <= 0) {
                alert("Monto inválido para el pago");
                return;
            }

            // Mostrar estado de carga
            $modal.find('.modal-body').html('<div class="loading-payment">Preparando pago...</div>');

            const res = await fetch('/.netlify/functions/crearPago', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    orderId,
                    urlReturn: `${urlBase}/return.html`,
                    urlConfirmation: `${urlBase}/.netlify/functions/flowCallback`
                })
            });

            const data = await res.json();

            if (data.url) {
                // Abrir en nueva pestaña en lugar de iframe
                const paymentWindow = window.open(data.url, '_blank', 'width=800,height=600');

                if (!paymentWindow) {
                    alert("El navegador bloqueó la ventana emergente. Por favor permite ventanas emergentes para este sitio.");
                    $modal.find('.modal-body').html(`
                        <div class="payment-error">
                            <p>El navegador bloqueó la ventana de pago. Por favor permite ventanas emergentes.</p>
                            <button class="btn btn-primary" onclick="window.open('${data.url}', '_blank')">Abrir Pago</button>
                            <button class="btn btn-secondary btn-close-modal">Cancelar</button>
                        </div>
                    `);
                    return;
                }

                // Escuchar mensajes desde return.html
                const handlePagoMensaje = async (event) => {
                    if (!event.data || event.data.tipo !== 'pagoCompletado') return;

                    const token = event.data.token || localStorage.getItem('lastToken');
                    window.removeEventListener('message', handlePagoMensaje);

                    // Verificar estado del pago
                    const checkRes = await fetch('/.netlify/functions/consultarPago', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });

                    const checkData = await checkRes.json();

                    if (checkData.status === 1) {
                        showPaymentResult($modal, true);
                        paymentWindow.close();
                    } else {
                        // Liberar asientos
                        for (const seat of selectedSeats) {
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
                                $(`.seat[data-seat="${seat.seat}"]`).removeClass('selected').addClass('available');
                            } catch {
                                console.error(`Error al liberar asiento ${seat.seat}`);
                            }
                        }

                        selectedSeats.length = 0;
                        updateTicketDetails();

                        const codigoError = checkData?.paymentData?.errorCode ?? 999;
                        const mensajeError = obtenerMensajeErrorFlow(codigoError);

                        $modal.find('.modal-body').html(`
                            <div class="payment-error">
                                <h4>Error en el pago</h4>
                                <p>${mensajeError}</p>
                                <button class="btn btn-primary btn-close-modal">Aceptar</button>
                            </div>
                        `);
                    }
                };

                window.addEventListener('message', handlePagoMensaje);
            } else {
                alert("Error al iniciar pago con Flow");
                console.error(data);
                $modal.find('.modal-body').html(`
                    <div class="payment-error">
                        <p>Error al conectar con el sistema de pagos</p>
                        <button class="btn btn-secondary btn-close-modal">Volver</button>
                    </div>
                `);
            }
        } catch (error) {
            console.error("Error en pago web:", error);
            $modal.find('.modal-body').html(`
                <div class="payment-error">
                    <p>Error al procesar el pago</p>
                    <button class="btn btn-secondary btn-close-modal">Volver</button>
                </div>
            `);
        }
    }

    if (method === 'cash') {
        // Lógica para pago en efectivo u otro método
        let processed = 0;
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
                    authCode: authCode,
                    userId: 'usuario123'
                }),
                success: () => {
                    $(`[data-seat="${s.seat}"]`).removeClass('selected').addClass('reserved').off('click');
                    processed++;

                    if (processed === selectedSeats.length) {
                        showPaymentResult($modal, originalModalContent, true);
                    }
                },
                error: () => {
                    processed++;
                    if (processed === selectedSeats.length) {
                        showPaymentResult($modal, originalModalContent, false);
                    }
                }
            });
        });
    }

}

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

        // Resetear la interfaz después de pago exitoso
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
// Inicializar los botones de pago al cargar la página
initPaymentButtons();


