// Simple script to check category values without DB connection
// This will help us understand what the actual category values might be

const fs = require('fs');
const path = require('path');

// Read prices.json to see if 포도 and 흑찰옥수수 are there
const pricesPath = path.join(__dirname, 'public', 'prices.json');
if (fs.existsSync(pricesPath)) {
  const prices = JSON.parse(fs.readFileSync(pricesPath, 'utf8'));
  
  console.log('=== Checking prices.json for problematic products ===\n');
  
  const 포도Entries = prices.filter(p => p.name && p.name.includes('포도'));
  const 찰옥수수Entries = prices.filter(p => p.name && p.name.includes('찰옥수수'));
  
  console.log('포도 entries in prices.json:');
  console.log(JSON.stringify(포도Entries.slice(0, 5), null, 2));
  
  console.log('\n찰옥수수 entries in prices.json:');
  console.log(JSON.stringify(찰옥수수Entries.slice(0, 5), null, 2));
  
  console.log('\nTotal 포도 entries:', 포도Entries.length);
  console.log('Total 찰옥수수 entries:', 찰옥수수Entries.length);
} else {
  console.log('prices.json not found at:', pricesPath);
}

// Check PRODUCT_CATEGORIES from types
const typesPath = path.join(__dirname, 'src', 'lib', 'types.ts');
if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  
  // Extract PRODUCT_CATEGORIES
  const match = typesContent.match(/PRODUCT_CATEGORIES\s*=\s*\[([\s\S]*?)\]/);
  if (match) {
    console.log('\n=== PRODUCT_CATEGORIES from types.ts ===');
    console.log(match[0]);
  }
} else {
  console.log('types.ts not found at:', typesPath);
}
