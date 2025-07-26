import app from "./app.js";
import "./database.js";
import http from "http";
import { Server } from "socket.io";
import sockets from "./sockets.js";
import { PORT } from "./config.js";
import os from 'os';

const server = http.createServer(app);
const io = new Server(server);

sockets(io);

// Función para obtener la IP local
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const { address, family, internal } = iface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
}

// Función para obtener la IP pública (solo para referencia)
function getPublicIpAddress() {
  return '45.178.0.92'; // Tu IP pública
}

// Iniciar el servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Servidor en ejecución ===`);
  console.log(`Local:            http://localhost:${PORT}`);
  console.log(`En tu red local:  http://${getLocalIpAddress()}:${PORT}`);
  console.log(`Desde Internet:   http://45.178.0.92:${PORT}`);
  console.log(`\nAsegúrate de que el puerto ${PORT} esté abierto en tu router/firewall.`);
});
