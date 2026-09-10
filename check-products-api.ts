// This script will call the admin API to check product data
async function checkProducts() {
  const baseUrl = 'http://localhost:3001';
  
  // First, try to get all products without filters
  console.log('Fetching all products...');
  const allRes = await fetch(`${baseUrl}/api/admin/products?activeOnly=false&includeOutOfStock=true`);
  const allData = await allRes.json();
  
  console.log('Response:', allData);
  
  if (!allData.products) {
    console.log('No products array in response');
    return;
  }
  
  // Find 포도 and 찰옥수수
  const 포도 = allData.products.find((p: any) => p.name.includes('포도'));
  const 찰옥수수 = allData.products.find((p: any) => p.name.includes('찰옥수수'));
  
  console.log('포도:', JSON.stringify(포도, null, 2));
  console.log('찰옥수수:', JSON.stringify(찰옥수수, null, 2));
  
  if (포도) {
    console.log(`\n포도 category: "${포도.category}"`);
    console.log(`포도 isActive: ${포도.isActive}`);
    console.log(`포도 isOutOfStock: ${포도.isOutOfStock}`);
  }
  
  if (찰옥수수) {
    console.log(`\n찰옥수수 category: "${찰옥수수.category}"`);
    console.log(`찰옥수수 isActive: ${찰옥수수.isActive}`);
    console.log(`찰옥수수 isOutOfStock: ${찰옥수수.isOutOfStock}`);
  }
  
  // Now try to fetch by category
  if (포도) {
    console.log(`\n\nFetching products in category "${포도.category}"...`);
    const catRes = await fetch(`${baseUrl}/api/admin/products?activeOnly=false&includeOutOfStock=true&category=${encodeURIComponent(포도.category)}`);
    const catData = await catRes.json();
    console.log(`Found ${catData.products.length} products in category "${포도.category}"`);
    console.log('Product names:', catData.products.map((p: any) => p.name));
    
    const 포도InCategory = catData.products.find((p: any) => p.name.includes('포도'));
    console.log('포도 in category result:', 포도InCategory ? 'FOUND' : 'NOT FOUND');
  }
}

checkProducts().catch(console.error);
