const qrcode = require('qrcode-terminal');

// Obtener la IP desde los argumentos o usar la predeterminada
const ip = process.argv[2] || '192.168.1.18';
const port = process.argv[3] || '3000';
const url = `http://${ip}:${port}`;

console.log('\n🔗 URL para acceder desde la tablet:');
console.log(`   ${url}\n`);
console.log('📱 Escanea el código QR con tu tablet:\n');

qrcode.generate(url, { small: true }, function (qrcode) {
  console.log(qrcode);
});

console.log('\n💡 Asegúrate de que la tablet esté en la misma red WiFi\n');
