document.addEventListener('DOMContentLoaded', () => {
    function isTokenExpired(token) {
        if (!token) return true;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp < Math.floor(Date.now() / 1000);
        } catch (e) {
            return true;
        }
    }

    function showError(message) {
        const errorElement = document.getElementById('error');
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.textContent = '';
            errorElement.classList.add('hidden');
        }, 5000);
    }

    function showSuccess(message) {
        const successElement = document.getElementById('success');
        successElement.textContent = message;
        successElement.classList.remove('hidden');
        setTimeout(() => {
            successElement.textContent = '';
            successElement.classList.add('hidden');
        }, 5000);
    }

    function showStatus(message) {
        const statusElement = document.getElementById('statusInfo');
        statusElement.textContent = message;
        statusElement.classList.remove('hidden');
    }

    function showVentas(message) {
        const ventasElement = document.getElementById('ventasInfo');
        ventasElement.innerHTML = message;
        ventasElement.classList.remove('hidden');
    }

    function showCierre(message) {
        const cierreElement = document.getElementById('cierreInfo');
        cierreElement.innerHTML = message;
        cierreElement.classList.remove('hidden');
    }

    function hideMessages() {
        document.getElementById('statusInfo').classList.add('hidden');
        document.getElementById('ventasInfo').classList.add('hidden');
        document.getElementById('cierreInfo').classList.add('hidden');
        document.getElementById('error').classList.add('hidden');
        document.getElementById('success').classList.add('hidden');
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP'
        }).format(amount);
    }

    function logout() {
        if (localStorage.getItem('idCaja')) {
            showError("Debes cerrar la caja antes de salir");
            return;
        }

        const confirmar = confirm("¿Estás seguro de cerrar sesión?");
        if (!confirmar) return;

        localStorage.clear();
        window.location.href = '/index.html';
    }

    // Variables globales
    const token = localStorage.getItem('tokenSesion');
    const user = JSON.parse(localStorage.getItem('user'));
    const idCaja = localStorage.getItem('idCaja');

    // Verificación de sesión
    if (isTokenExpired(token)) {
        logout();
    } else {
        if (user) {
            showStatus(`Bienvenido/a: ${user.name}`);
            console.log("Usuario:", user.name, "-", user.email);
        }

        if (idCaja) {
            console.log("Caja activa:", idCaja);
            document.getElementById('btnAbrirCaja').disabled = true;
            document.getElementById('btnCerrarCaja').disabled = false;
            document.getElementById('irACaja').disabled = false;
            document.getElementById('btnVendido').disabled = false;
        } else {
            document.getElementById('btnAbrirCaja').disabled = false;
            document.getElementById('btnCerrarCaja').disabled = true;
            document.getElementById('irACaja').disabled = true;
            document.getElementById('btnVendido').disabled = true;
        }
    }

    // Abrir formulario
    document.getElementById('btnAbrirCaja').addEventListener('click', () => {
        if (localStorage.getItem('idCaja')) {
            showError('Ya hay una caja abierta');
            return;
        }
        document.getElementById('saldoForm').classList.remove('hidden');
    });

    // Confirmar saldo y abrir caja
    document.getElementById('btnConfirmarSaldo').addEventListener('click', async () => {
        const input = document.getElementById('saldoInicial');
        const saldo = parseFloat(input.value);

        if (input.value === '' || isNaN(saldo) || saldo < 0) {
            showError('Ingrese un saldo válido');
            return;
        }

        document.getElementById('btnConfirmarSaldo').disabled = true;
        await abrirCaja(saldo);
        document.getElementById('saldoForm').classList.add('hidden');
        document.getElementById('btnConfirmarSaldo').disabled = false;
        input.value = '';
    });


    document.getElementById('btnVendido').addEventListener('click', async () => {
        const id = localStorage.getItem('idCaja');
        if (!id) {
            showError('No hay una caja abierta');
            return;
        }

        try {
            const res = await fetch(`https://boletos.dev-wit.com/api/movimientos/caja/${id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Error al obtener las ventas');
            }

            const movimientos = await res.json();

            const ingresos = movimientos.filter(mov => mov.tipo === 'ingreso');

            const totalEfectivo = ingresos
                .filter(mov => mov.medioPago === 'efectivo')
                .reduce((sum, mov) => sum + mov.monto, 0);

            const totalTarjeta = ingresos
                .filter(mov => mov.medioPago === 'tarjeta')
                .reduce((sum, mov) => sum + mov.monto, 0);

            const totalVendido = totalEfectivo + totalTarjeta;

            showVentas(`
<strong>Resumen de Ventas:</strong><br>
Total Vendido: ${formatCurrency(totalVendido)}<br>
- Efectivo: ${formatCurrency(totalEfectivo)}<br>
- Tarjeta: ${formatCurrency(totalTarjeta)}<br>
N° de Transacciones: ${ingresos.length}
`);

        } catch (err) {
            console.error(err);
            showError(err.message);
        }

    });

    async function abrirCaja(saldoInicial = 0) {
        try {
            const res = await fetch('https://boletos.dev-wit.com/api/cajas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    usuario: user.email,
                    saldoInicial
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Error al abrir la caja');
            }

            const data = await res.json();
            localStorage.setItem('idCaja', data._id);
            showStatus(`
            Caja abierta,

            Saldo inicial: ${formatCurrency(saldoInicial)}
            Fecha: ${formatDate(data.fechaApertura)}
        `);

            document.getElementById('btnAbrirCaja').disabled = true;
            document.getElementById('btnCerrarCaja').disabled = false;
            document.getElementById('irACaja').disabled = false;
            document.getElementById('btnVendido').disabled = false;
        } catch (err) {
            console.error(err);
            showError(err.message);
        }
    }

    async function cerrarCaja() {
        const confirmar = confirm("Después de cerrar la caja no podrás ver lo vendido");

        if (!confirmar) {
            return;
        }
        const id = localStorage.getItem('idCaja');
        if (!id) {
            showError('No hay una caja abierta');
            return;
        }

        try {
            const res = await fetch(`https://boletos.dev-wit.com/api/cajas/${id}/cerrar`, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!res.ok) {
                const error = await res.json();
                showError(error.error || 'Error al cerrar la caja, pero podrás abrir otra');
                localStorage.removeItem('idCaja');

                document.getElementById('btnAbrirCaja').disabled = false;
                document.getElementById('btnCerrarCaja').disabled = true;
                document.getElementById('irACaja').disabled = true;
                document.getElementById('btnVendido').disabled = true;
                return;
            }

            const data = await res.json();
            localStorage.removeItem('idCaja');

            showCierre(`
            <strong>Caja cerrada con éxito</strong><br>
            Fecha de cierre: ${formatDate(data.fechaCierre)}<br>
            Saldo inicial: ${formatCurrency(data.saldoInicial)}
        `);

            document.getElementById('btnAbrirCaja').disabled = false;
            document.getElementById('btnCerrarCaja').disabled = true;
            document.getElementById('irACaja').disabled = true;
            document.getElementById('btnVendido').disabled = true;
        } catch (err) {
            console.error(err);
            showError('Error inesperado al cerrar la caja');
            localStorage.removeItem('idCaja');
            document.getElementById('btnAbrirCaja').disabled = false;
            document.getElementById('btnCerrarCaja').disabled = true;
            document.getElementById('irACaja').disabled = true;
            document.getElementById('btnVendido').disabled = true;
        }
    }

    function redirigir() {
        if (!token || !user || !localStorage.getItem('idCaja')) {
            showError("Faltan datos para continuar");
            return;
        }
        window.location.href = '/app.html';
    }

    // Eventos
    document.getElementById('btnCerrarCaja').addEventListener('click', cerrarCaja);
    document.getElementById('irACaja').addEventListener('click', redirigir);
    document.getElementById('btnCerrarSesion').addEventListener('click', logout);

});