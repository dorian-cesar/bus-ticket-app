// functions/login.js
const jwt = require('jsonwebtoken');

const USERS = {
  cajera1: 'clave123',
  cajera2: 'clave456',
};

const SECRET_KEY = 'supersecreto';

exports.handler = async (event) => {
  const { username, password } = JSON.parse(event.body || '{}');

  if (USERS[username] && USERS[username] === password) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '12h' });
    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  }

  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Credenciales inválidas' }),
  };
};
