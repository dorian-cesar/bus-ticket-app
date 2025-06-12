const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzQ5MjIzNDYxLCJleHAiOjE3NDkyNTU4NjF9.gLdrZCl7LMp7smbNip5JHjSEn-9-hx0OzKknd6cYSr0';
let currentServiceId = '';
let selectedSeat = '';
console.log("script.js cargado");

$('#searchForm').on('submit', function (e) {
  e.preventDefault();
  const origin = $('#origin').val();
  const destination = $('#destination').val();
  const date = $('#date').val();

  const url = `https://boletos.dev-wit.com/api/services?origin=${origin}&destination=${destination}&date=${date}`;
  $.get(url, function (data) {
    $('#serviceList').empty();
    data.forEach(service => {
      $('#serviceList').append(`
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            <strong>${service.departureTime}</strong> - ${service.company}  (${service.busTypeDescription}) <div>Piso 1 ${service.seatDescriptionFirst}-$${service.priceFirst}</div>
            <div>Piso 2 ${service.seatDescriptionSecond}-$${service.priceSecond}</div>
          </span>
          <button class="btn btn-outline-primary btn-sm selectServiceBtn" data-id="${service.id}">Ver Asientos</button>
        </li>
      `);
    });
  });
});

$(document).on('click', '.selectServiceBtn', function () {
  const serviceId = $(this).data('id');
  currentServiceId = serviceId;
  selectedSeat = '';
  $('#seatLayout').empty();
  $('#confirmBtn').hide();

  const url = `https://boletos.dev-wit.com/api/services?origin=${$('#origin').val()}&destination=${$('#destination').val()}&date=${$('#date').val()}`;

  $.get(url, function (data) {
    const service = data.find(s => s.id === serviceId);
    if (!service) return;

    const layout = service.layout;

    const renderSeats = (floorName, seatMap) => {
      $('#seatLayout').append(`<h6>${floorName}</h6>`);
      seatMap.forEach(row => {
        const rowDiv = $('<div class="d-flex"></div>');
        row.forEach(seat => {
          if (seat === '') {
            rowDiv.append(`<div class="seat empty"></div>`);
          } else {
            rowDiv.append(`<div class="seat available" data-seat="${seat}">${seat}</div>`);
          }
        });
        $('#seatLayout').append(rowDiv);
      });
    };

    if (layout.floor1) renderSeats('Primer Piso', layout.floor1.seatMap);
    if (layout.floor2) renderSeats('Segundo Piso', layout.floor2.seatMap);
    if (layout.seatMap) renderSeats('Único Piso', layout.seatMap);
  });
});

$(document).on('click', '.available', function () {
  $('.seat').removeClass('selected');
  $(this).addClass('selected');
  selectedSeat = $(this).data('seat');
  $('#confirmBtn').show();
});

$('#confirmBtn').on('click', function () {
  if (!selectedSeat || !currentServiceId) return;

  $.ajax({
    url: `https://boletos.dev-wit.com/api/seats/${currentServiceId}/reserve`,
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({
      seatNumber: selectedSeat,
      userId: 'usuario123'
    }),
    success: function () {
      alert(`Asiento ${selectedSeat} reservado con éxito`);
      $(`[data-seat="${selectedSeat}"]`).removeClass('available selected').addClass('reserved').off('click');
      $('#confirmBtn').hide();
      selectedSeat = '';
    },
    error: function () {
      alert('Error al reservar el asiento');
    }
  });
});
