console.log("script cargado");
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzUwMDgxNDIyLCJleHAiOjE3NTAxMTM4MjJ9._-T2Tw2E7tWb23g_gIcLWlAFPSoKTBe9QAvQv66M9lA';

let currentServiceId = '';
let selectedSeats = [];
let currentServiceData = null;

$(document).ready(function () {
    $('.seccion1').addClass('active');

    $.get('https://boletos.dev-wit.com/api/routes/origins', function (data) {
        $('#origin').append('<option disabled selected>Seleccione</option>');
        data.forEach(route => {
            $('#origin').append(`<option value="${route.origen}">${route.origen}</option>`);
        });

        $('#origin').on('change', function () {
            const selectedOrigin = $(this).val();
            const destinos = data.find(r => r.origen === selectedOrigin)?.destinos || [];
            $('#destination').empty().append('<option disabled selected>Seleccione</option>');
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

    updateTravelSummary(originText, destinationText, formattedDate);

    $('#serviceList').empty().append(`
        <li class="list-group-item loading" style="height: 100px;"></li>
        <li class="list-group-item loading" style="height: 100px;"></li>
    `);

    $.get(`https://boletos.dev-wit.com/api/services?origin=${origin}&destination=${destination}&date=${date}`, function (data) {
        $('#serviceList').empty();
        if (data.length === 0) {
            $('#serviceList').append('<li class="list-group-item">No hay servicios disponibles</li>');
            return;
        }

        data.forEach(service => {
            $('#serviceList').append(`
                <li class="list-group-item">
                    <div class="contenido-item">
                        <div class="contenido-servicio">
                            <div class="header-servicio">
                            ${service.availableSeats} Asientos Disponibles <br>
                            <strong>${service.departureTime}</strong> - <strong>${service.arrivalTime}</strong> 
                            </div>
                        
                            <span>
                                
                                ${service.company} (${service.busTypeDescription})
                                <div>Piso 1 ${service.seatDescriptionFirst}- <strong>$${service.priceFirst}</strong></div>
                                <div>Piso 2 ${service.seatDescriptionSecond}- <strong>$${service.priceSecond}</strong></div>
                            </span>
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


function updateTravelSummary(origin, destination, date) {
    $('#origen').text(origin);
    $('#destino').text(destination);
    $('#fecha').text(date);
    

    $('.seccion3').addClass('active');
}

$(document).on('click', '.selectServiceBtn', function () {
    const serviceId = $(this).data('id');
    currentServiceId = serviceId;
    selectedSeats = [];

    $('.contenido-seccion').removeClass('active');
    $('#seatLayout').empty().append(`
        <div class="loading" style="height: 300px; width: 100%;"></div>
    `);
    $('#ticketDetails').empty().hide();
    $('.seccion2').addClass('active');

    $.get(`https://boletos.dev-wit.com/api/services?origin=${$('#origin').val()}&destination=${$('#destination').val()}&date=${$('#date').val()}`, function (data) {
        currentServiceData = data.find(s => s.id === serviceId);
        const layout = currentServiceData.layout;

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

            if (layout.floor1) renderSeats('Primer Piso', layout.floor1.seatMap, 1);
            if (layout.floor2) renderSeats('Segundo Piso', layout.floor2.seatMap, 2);
            if (layout.seatMap) renderSeats('Único Piso', layout.seatMap, 1);
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

$(document).on('click', '.seat.available, .seat.selected', function () {
    const seat = $(this).data('seat');
    const floor = $(this).data('floor');
    const index = selectedSeats.findIndex(s => s.seat === seat);

    if ($(this).hasClass('selected')) {
        // Liberar asiento
        $.ajax({
            url: 'https://boletos.dev-wit.com/api/services/revert-seat',
            method: 'PATCH',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                serviceId: currentServiceId,
                seatNumber: seat
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
                Authorization: token,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({ seatNumber: seat, userId: 'usuario123' }),
            success: () => {
                $(this).removeClass('available').addClass('selected');
                const price = floor === 1 ? currentServiceData.priceFirst : currentServiceData.priceSecond;
                selectedSeats.push({ seat, floor, price });
                updateTicketDetails();
            },
            error: () => {
                alert('Error al reservar el asiento');
            }
        });
    }
});

function updateTicketDetails() {
    const $ticketDetails = $('#ticketDetails');

    if (selectedSeats.length === 0) {
        $ticketDetails.empty().hide();
        return;
    }

    $ticketDetails.show();

    let html = '<ul class="lista-asientos">';
    selectedSeats.forEach(s => {
        html += `<li class="lista-asientos-item">Asiento ${s.seat} (Piso ${s.floor}) - $${s.price}</li>`;
    });
    html += '</ul><button class="btn btn-primary btn-confirmar">Confirmar</button>';

    $ticketDetails.html(html).hide().fadeIn(300);
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


// Función para inicializar los eventos de pago
function initPaymentButtons() {
    $(document).off('click', '#payWeb, #payCash').on('click', '#payWeb, #payCash', handlePayment);
}

// Función principal de manejo de pagos
function handlePayment() {
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

    // Simular pago y confirmar asientos
    let processed = 0;
    selectedSeats.forEach(s => {
        $.ajax({
            url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/confirm`,
            method: 'POST',
            headers: {
                Authorization: token,
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

// Función para mostrar el resultado del pago
function showPaymentResult($modal, originalContent, isSuccess) {
    $modal.find('.modal-body').html(`
        <div class="payment-${isSuccess ? 'success' : 'error'}">
            <h4>${isSuccess ? '¡Pago exitoso!' : 'Error en el pago'}</h4>
            <p>${isSuccess ? 'Los asientos han sido reservados correctamente.' : 'Algunos asientos no pudieron ser reservados.'}</p>
            <button class="btn btn-primary btn-restore-payment-options btn-close-modal">Aceptar</button>
        </div>
    `);
    
    selectedSeats = [];
    $('#ticketDetails').empty().hide();
    
    // Configurar el botón para restaurar el contenido
    $(document).off('click', '.btn-restore-payment-options').on('click', '.btn-restore-payment-options', function() {
        $modal.find('.modal-body').html(originalContent);
        initPaymentButtons(); // Re-inicializar los botones de pago
    });
}

// Inicializar los botones de pago al cargar la página
initPaymentButtons();