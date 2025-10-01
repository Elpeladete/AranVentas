const { networkInterfaces } = require('os');

function getLocalNetworkIP() {
  const nets = networkInterfaces();
  const results = {};

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Saltar direcciones internas (localhost) y IPv6
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }
  
  // Buscar la IP de Wi-Fi primero
  const wifiIP = results['Wi-Fi'] || results['WiFi'] || results['Wireless'];
  if (wifiIP && wifiIP[0]) {
    return wifiIP[0];
  }
  
  // Si no encuentra Wi-Fi, buscar Ethernet
  const ethernetIP = results['Ethernet'] || results['Local Area Connection'];
  if (ethernetIP && ethernetIP[0]) {
    return ethernetIP[0];
  }
  
  // Retornar la primera IP encontrada
  const allIPs = Object.values(results).flat();
  return allIPs[0] || '192.168.1.100';
}

const ip = getLocalNetworkIP();
console.log(ip);
module.exports = { getLocalNetworkIP };