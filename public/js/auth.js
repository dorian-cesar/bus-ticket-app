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

async function obtenerToken() {
    const res = await fetch('/.netlify/functions/generarToken');
    const data = await res.json();
    jwtToken = data.token;
}

function atras() {
    window.location.href = '/html/caja.html';
    localStorage.removeItem('pendingPayment');
    localStorage.removeItem('currentPayment');
}

// Validar sesión
const loginToken = localStorage.getItem('tokenSesion');
const user = JSON.parse(localStorage.getItem('user'));
const idCaja = localStorage.getItem('idCaja');

if (isTokenExpired(loginToken) || !idCaja) {
    localStorage.clear();
    window.location.href = '/index.html';
} else {
    if (user) {
        console.log("nombre: ", user.name);
        console.log("correo: ", user.email);
    }

    if (idCaja) {
        console.log("caja: ", idCaja);
    }
}

let jwtToken = null;

setInterval(() => {
    const tokenSesion = localStorage.getItem('tokenSesion');
    if (!tokenSesion || isTokenExpired(tokenSesion)) {
        alert('Tu sesión ha expirado. Por favor vuelve a iniciar sesión.');
        localStorage.clear();
        window.location.href = '/index.html';
    }
}, 20000);

window.addEventListener('pageshow', () => {
    const token = localStorage.getItem('tokenSesion');
    if (!token || isTokenExpired(token) && !idCaja) {
        localStorage.removeItem('tokenSesion');
        window.location.href = '/index.html';
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    if (user && user.name) {
        document.getElementById('userName').textContent = user.name || 'Usuario';
    }

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) logoutButton.addEventListener('click', atras);
});
