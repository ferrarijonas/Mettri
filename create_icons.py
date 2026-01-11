#!/usr/bin/env python3
"""
Script para criar ícones PNG básicos para a extensão
Execute: python create_icons.py
Requer: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Erro: Pillow não instalado. Execute: pip install Pillow")
    exit(1)

import os

# Criar diretório se não existir
icons_dir = os.path.join('assets', 'icons')
os.makedirs(icons_dir, exist_ok=True)

def create_icon(size):
    """Cria um ícone PNG simples com o tamanho especificado"""
    # Criar imagem com fundo verde WhatsApp
    img = Image.new('RGB', (size, size), color='#25D366')
    draw = ImageDraw.Draw(img)
    
    # Desenhar balão de mensagem branco
    margin = int(size * 0.2)
    width = size - (margin * 2)
    height = int((size - (margin * 2)) * 0.7)
    
    # Corpo do balão (retângulo arredondado)
    x1, y1 = margin, margin
    x2, y2 = margin + width, margin + height
    radius = int(size * 0.1)
    
    # Desenhar retângulo arredondado
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill='white')
    
    # Desenhar cauda do balão (triângulo)
    tail_points = [
        (margin + int(width * 0.3), margin + height),
        (margin + int(width * 0.2), margin + int(height * 1.3)),
        (margin + int(width * 0.4), margin + int(height * 1.1))
    ]
    draw.polygon(tail_points, fill='white')
    
    return img

# Criar ícones em diferentes tamanhos
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    filename = os.path.join(icons_dir, f'icon{size}.png')
    icon.save(filename, 'PNG')
    print(f'Criado: {filename}')

print(f'\nTodos os ícones criados em {icons_dir}/')

