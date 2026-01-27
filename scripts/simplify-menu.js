/**
 * Simplify Toast menu JSON for Bland.ai knowledge base
 * Removes unnecessary fields and modifier references to reduce size dramatically
 */

const fs = require('fs');
const path = require('path');

function simplifyMenu(toastMenu) {
  if (!toastMenu || !toastMenu.menus) {
    return { menus: [] };
  }

  const simplified = {
    menus: []
  };

  for (const menu of toastMenu.menus) {
    const simplifiedMenu = {
      name: menu.name,
      menuGroups: []
    };

    if (!menu.menuGroups) continue;

    for (const group of menu.menuGroups) {
      // Skip groups with no items
      if (!group.menuItems || group.menuItems.length === 0) continue;

      const simplifiedGroup = {
        name: group.name,
        items: []
      };

      for (const item of group.menuItems) {
        // Skip items without visibility (hidden from ordering)
        if (!item.visibility || item.visibility.length === 0) {
          continue;
        }

        // Check if visible for online ordering
        const isVisible = item.visibility.includes('TOAST_ONLINE_ORDERING') ||
                         item.visibility.includes('ORDERING_PARTNERS');

        if (!isVisible) {
          continue;
        }

        // Only keep essential fields
        const simplifiedItem = {
          name: item.name,
          price: item.price
        };

        // Add description if it exists and is meaningful
        if (item.description && item.description.trim()) {
          simplifiedItem.description = item.description.trim();
        }

        // Add image if it exists
        if (item.image) {
          simplifiedItem.image = item.image;
        }

        simplifiedGroup.items.push(simplifiedItem);
      }

      // Only add group if it has visible items
      if (simplifiedGroup.items.length > 0) {
        simplifiedMenu.menuGroups.push(simplifiedGroup);
      }
    }

    // Only add menu if it has groups with items
    if (simplifiedMenu.menuGroups.length > 0) {
      simplified.menus.push(simplifiedMenu);
    }
  }

  return simplified;
}

function formatMenuAsText(simplifiedMenu, restaurantName = 'Restaurant') {
  let text = `${restaurantName} MENU\n\n`;
  let totalItems = 0;

  for (const menu of simplifiedMenu.menus) {
    // Add menu name if there are multiple menus
    if (simplifiedMenu.menus.length > 1) {
      text += `=== ${menu.name.toUpperCase()} ===\n\n`;
    }

    for (const group of menu.menuGroups) {
      text += `${group.name.toUpperCase()}:\n`;

      for (const item of group.items) {
        totalItems++;
        const price = typeof item.price === 'number' ? item.price.toFixed(2) : item.price;

        // Truncate long descriptions
        let description = item.description || '';
        if (description.length > 100) {
          description = description.substring(0, 97) + '...';
        }

        if (description) {
          text += `  • ${item.name} - $${price} - ${description}\n`;
        } else {
          text += `  • ${item.name} - $${price}\n`;
        }
      }

      text += `\n`;
    }
  }

  return { text, totalItems };
}

// Main execution
async function main() {
  const inputPath = path.join(__dirname, '../asset/menu.json');
  const outputJsonPath = path.join(__dirname, '../asset/menu-simplified.json');
  const outputTextPath = path.join(__dirname, '../asset/menu-simplified.txt');

  console.log('Reading Toast menu JSON...');
  const rawData = fs.readFileSync(inputPath, 'utf8');
  const originalSizeKB = Math.round(rawData.length / 1024);
  console.log(`Original file size: ${originalSizeKB}KB`);

  console.log('\nParsing JSON...');
  const toastMenu = JSON.parse(rawData);

  console.log('\nSimplifying menu structure...');
  const simplified = simplifyMenu(toastMenu);

  // Write simplified JSON
  const simplifiedJson = JSON.stringify(simplified, null, 2);
  fs.writeFileSync(outputJsonPath, simplifiedJson);
  const simplifiedSizeKB = Math.round(simplifiedJson.length / 1024);
  console.log(`\n✅ Simplified JSON saved: ${outputJsonPath}`);
  console.log(`   Size: ${simplifiedSizeKB}KB (reduced by ${Math.round((1 - simplifiedSizeKB/originalSizeKB) * 100)}%)`);

  // Format as text
  console.log('\nFormatting as plain text...');
  const { text, totalItems } = formatMenuAsText(simplified, 'Restaurant');
  fs.writeFileSync(outputTextPath, text);
  const textSizeKB = Math.round(text.length / 1024);

  console.log(`\n✅ Text menu saved: ${outputTextPath}`);
  console.log(`   Total items: ${totalItems}`);
  console.log(`   Size: ${textSizeKB}KB`);

  console.log('\n📊 Summary:');
  console.log(`   Original:   ${originalSizeKB}KB (${Math.round(rawData.length / 1024 / 1024 * 100) / 100}MB)`);
  console.log(`   JSON:       ${simplifiedSizeKB}KB (${Math.round((1 - simplifiedSizeKB/originalSizeKB) * 100)}% reduction)`);
  console.log(`   Text:       ${textSizeKB}KB (${Math.round((1 - textSizeKB/originalSizeKB) * 100)}% reduction)`);
  console.log(`   Menu items: ${totalItems}`);

  if (textSizeKB > 50) {
    console.log(`\n⚠️  Warning: Menu is still large (${textSizeKB}KB). Bland.ai may have trouble processing it.`);
    console.log('   Consider filtering categories or items further.');
  } else {
    console.log(`\n✅ Menu size is good for Bland.ai!`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
