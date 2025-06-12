console.log("script cargado")
const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzQ5NzM2OTAyLCJleHAiOjE3NDk3NjkzMDJ9.PrzUqNwoZAMLS5mC-PNWTwyhZJevkhh5Vp7bWSoB4rU';

let currentServiceId = '';
let selectedSeats = [];
let currentServiceData = null;

$(document).ready(function () {
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

    $.get(`https://boletos.dev-wit.com/api/services?origin=${origin}&destination=${destination}&date=${date}`, function (data) {
        $('#serviceList').empty();
        data.forEach(service => {
            $('#serviceList').append(`
          <li class="list-group-item">
          <div class="contenido-item">
          <div class="contenido-servicio">
          <span>
            <strong>${service.departureTime}</strong> - ${service.company}  (${service.busTypeDescription}) <div>Piso 1 ${service.seatDescriptionFirst}-$${service.priceFirst}</div>
            <div>Piso 2 ${service.seatDescriptionSecond}-$${service.priceSecond}</div>
            </span>
          </div>
            <div class="button-servicio">
            <button class="btn selectServiceBtn btn-primary" data-id="${service.id}">Ver Asientos</button>
            </div>
          </div>
          
          </li>
        `);
        });
    });
});

$(document).on('click', '.selectServiceBtn', function () {
    const serviceId = $(this).data('id');
    currentServiceId = serviceId;
    selectedSeats = [];
    $('#seatLayout').empty();
    $('#ticketDetails').empty();

    $.get(`https://boletos.dev-wit.com/api/services?origin=${$('#origin').val()}&destination=${$('#destination').val()}&date=${$('#date').val()}`, function (data) {
        currentServiceData = data.find(s => s.id === serviceId);
        const layout = currentServiceData.layout;

        $.get(`https://boletos.dev-wit.com/api/seats/${serviceId}`, function (seatStatusData) {
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
        });
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
            }
        });
    }
});

function updateTicketDetails() {
    if (selectedSeats.length === 0) {
        $('#ticketDetails').empty();
        return;
    }

    let html = '</ul><button class="btn btn-border" data-bs-toggle="modal" data-bs-target="#paymentModal">Pagar</button>';
    selectedSeats.forEach(s => {
        html += `<li class="lista-asientos-item">Asiento ${s.seat} (Piso ${s.floor}) - $${s.price}</li>`;
    });
    

    $('#ticketDetails').html(html);
}

$('#payWeb, #payCash').on('click', function () {
    const method = this.id === 'payWeb' ? 'web' : 'cash';
    const authCode = method === 'web' ? 'AUTHWEB123' : 'AUTHCASH123';

    // Simular pago y confirmar asientos
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
            }
        });
    });

    selectedSeats = [];
    $('#ticketDetails').empty();
    const modal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
    modal.hide();
});


document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('paymentModal');
    const openModalBtn = document.querySelector('#ticketDetails button.btn-warning');
    const closeButtons = modal.querySelectorAll('.btn-close, .btn-secondary');

    // Función para mostrar modal
    function showModal() {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        // Opcional: bloquear scroll de fondo
        document.body.style.overflow = 'hidden';
    }

    // Función para ocultar modal
    function hideModal() {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // Abrir modal al click en botón de pagar
    document.body.addEventListener('click', function (e) {
        if (e.target.matches('#ticketDetails button.btn-warning')) {
            showModal();
        }
    });

    // Cerrar modal al click en botones de cerrar o cancelar
    closeButtons.forEach(btn => {
        btn.addEventListener('click', hideModal);
    });

    // Cerrar modal si se hace click fuera del contenido del modal (overlay)
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            hideModal();
        }
    });

    // Opcional: cerrar modal con tecla ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            hideModal();
        }
    });
});
