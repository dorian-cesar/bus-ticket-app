const jwt = require("jsonwebtoken");

const dotenv = require("dotenv");

dotenv.config();

const SECRET_KEY = process.env.SECRET;
const USER = process.env.USER;

exports.handler = async function(event, context) {
  try {

    const token = jwt.sign({ username: USER }, SECRET_KEY, { expiresIn: "15m" });

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  } catch (error) {
    console.error("ERROR:::", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "No se pudo generar el token" }),
    };
  }
};
