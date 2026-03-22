#!/usr/bin/env node

/**
 * Script para cadastrar produtos de exemplo no painel admin
 * Testa o novo fluxo sem preço com várias variações
 */

const now = new Date().toISOString();

const products = {
  version: 1,
  updatedAt: now,
  season: "BBB26",
  products: [
    {
      id: "sofa-bege-3-lugares",
      title: "Sofá Bege 3 Lugares",
      subtitle: "Modelo confortável e elegante para sala de estar",
      category: "sala",
      imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
      badge: "Parecido com o da sala",
      affiliateUrl: "https://www.magazineluiza.com.br/sofa-3-lugares",
      featured: false,
      active: true,
      sortOrder: 1,
      tags: ["sofá", "sala", "conforto"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "mesa-jantar-moderna",
      title: "Mesa de Jantar Moderna",
      category: "sala",
      imageUrl: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&q=80",
      affiliateUrl: "https://www.magazineluiza.com.br/mesa-jantar",
      featured: false,
      active: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "conjunto-panelas-inox",
      title: "Conjunto de Panelas Inox",
      subtitle: "5 peças com revestimento antiaderente",
      category: "cozinha",
      imageUrl: "https://images.unsplash.com/photo-1584990347449-39b4aa1c2d05?w=800&q=80",
      badge: "Destaque da semana",
      affiliateUrl: "https://www.magazineluiza.com.br/conjunto-panelas",
      featured: true,
      active: true,
      sortOrder: 3,
      tags: ["panelas", "cozinha", "inox"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "cadeira-gamer-rgb",
      title: "Cadeira Gamer RGB",
      subtitle: "Ergonômica com iluminação LED",
      category: "quarto",
      imageUrl: "https://invalid-url-broken-image.com/cadeira.jpg",
      affiliateUrl: "https://www.magazineluiza.com.br/cadeira-gamer",
      featured: false,
      active: false,
      sortOrder: 4,
      tags: ["cadeira", "gamer", "rgb"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "geladeira-frost-free",
      title: "Geladeira Frost Free Inox",
      subtitle: "2 portas, 400 litros",
      category: "cozinha",
      imageUrl: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80",
      badge: "Igual a da cozinha",
      affiliateUrl: "https://www.magazineluiza.com.br/geladeira",
      featured: true,
      active: true,
      sortOrder: 5,
      tags: ["geladeira", "cozinha", "frost-free"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tv-smart-55",
      title: "Smart TV 55\" 4K",
      category: "sala",
      imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80",
      badge: "Mesmo modelo do quarto",
      affiliateUrl: "https://www.magazineluiza.com.br/smart-tv",
      featured: false,
      active: true,
      sortOrder: 6,
      tags: ["tv", "smart", "4k"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "ar-condicionado-split",
      title: "Ar Condicionado Split 12000 BTUs",
      subtitle: "Inverter com WiFi",
      category: "quarto",
      imageUrl: "https://images.unsplash.com/photo-1631545806609-4b0e7d6e0c4d?w=800&q=80",
      affiliateUrl: "https://www.magazineluiza.com.br/ar-condicionado",
      featured: false,
      active: true,
      sortOrder: 7,
      tags: ["ar-condicionado", "inverter", "wifi"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "colchao-queen",
      title: "Colchão Queen Size Molas",
      subtitle: "Pillow top extra conforto",
      category: "quarto",
      imageUrl: "https://broken-image-test.invalid/colchao.png",
      badge: "Produto inativo",
      affiliateUrl: "https://www.magazineluiza.com.br/colchao",
      featured: false,
      active: false,
      sortOrder: 8,
      tags: ["colchão", "queen", "molas"],
      createdAt: now,
      updatedAt: now
    }
  ]
};

async function saveProducts() {
  try {
    const apiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';
    
    console.log('🚀 Cadastrando produtos de exemplo...\n');
    console.log(`📦 Total de produtos: ${products.products.length}\n`);
    
    // Mostrar resumo dos produtos
    products.products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`);
      console.log(`   - Categoria: ${product.category}`);
      console.log(`   - Subtítulo: ${product.subtitle || '(sem subtítulo)'}`);
      console.log(`   - Badge: ${product.badge || '(sem badge)'}`);
      console.log(`   - Destaque: ${product.featured ? 'SIM' : 'NÃO'}`);
      console.log(`   - Status: ${product.active ? 'ATIVO' : 'INATIVO'}`);
      console.log(`   - Imagem: ${product.imageUrl.includes('invalid') || product.imageUrl.includes('broken') ? '❌ QUEBRADA' : '✅ VÁLIDA'}`);
      console.log('');
    });

    const response = await fetch('http://localhost:3000/api/save-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        data: products,
        expectedVersion: undefined
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Produtos cadastrados com sucesso!');
      console.log(`📄 Versão: ${result.version}`);
      console.log(`💾 Backup: ${result.backup || 'N/A'}`);
      console.log(`\n📁 Arquivo salvo em: tools/bbb-hosting/public/products-status.json`);
      console.log(`\n🌐 Acesse: http://localhost:3000/products`);
    } else {
      console.error('❌ Erro ao cadastrar produtos:');
      console.error(result);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
    process.exit(1);
  }
}

// Executar
saveProducts();
