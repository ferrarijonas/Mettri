// Script Node.js simples para criar ícones básicos
// Execute: node create-icons.js
// Requer: npm install canvas (ou use a versão HTML)

const fs = require('fs');
const path = require('path');

// Criar diretório se não existir
const iconsDir = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Criar ícones SVG simples (que podem ser convertidos depois)
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#25D366" rx="${size * 0.2}"/>
  <path d="M ${size * 0.2} ${size * 0.2} 
           L ${size * 0.8} ${size * 0.2} 
           Q ${size * 0.9} ${size * 0.2} ${size * 0.9} ${size * 0.3}
           L ${size * 0.9} ${size * 0.6}
           Q ${size * 0.9} ${size * 0.7} ${size * 0.8} ${size * 0.7}
           L ${size * 0.5} ${size * 0.7}
           L ${size * 0.35} ${size * 0.85}
           L ${size * 0.4} ${size * 0.7}
           L ${size * 0.2} ${size * 0.7}
           Q ${size * 0.1} ${size * 0.7} ${size * 0.1} ${size * 0.6}
           L ${size * 0.1} ${size * 0.3}
           Q ${size * 0.1} ${size * 0.2} ${size * 0.2} ${size * 0.2}
           Z" fill="white"/>
</svg>`;
  
  fs.writeFileSync(path.join(iconsDir, `icon${size}.svg`), svg);
  console.log(`Criado: icon${size}.svg`);
});

console.log('\nÍcones SVG criados!');
console.log('Para converter para PNG, você pode:');
console.log('1. Usar um conversor online (ex: cloudconvert.com)');
console.log('2. Abrir generate-icons.html no navegador');
console.log('3. Ou usar ImageMagick: magick convert icon16.svg icon16.png');













