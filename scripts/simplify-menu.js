/**
 * Simplify Toast menu JSON for Bland.ai knowledge base
 * Includes menu items with their modifier groups and options
 */

const fs = require('fs');
const path = require('path');

function simplifyMenu(toastMenu) {
  if (!toastMenu || !toastMenu.menus) {
    return { menus: [] };
  }

  // Build lookup maps for quick access
  const modifierGroupsMap = toastMenu.modifierGroupReferences || {};
  const modifierOptionsMap = toastMenu.modifierOptionReferences || {};

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

        // Build simplified item
        const simplifiedItem = {
          name: item.name,
          price: item.price
        };

        // Add description if it exists and is meaningful
        if (item.description && item.description.trim()) {
          simplifiedItem.description = item.description.trim();
        }

        // Resolve and add modifiers
        if (item.modifierGroupReferences && item.modifierGroupReferences.length > 0) {
          simplifiedItem.modifiers = [];

          for (const groupRef of item.modifierGroupReferences) {
            const modGroup = modifierGroupsMap[groupRef];
            if (!modGroup) continue;

            // Skip hidden modifier groups
            if (modGroup.visibility && modGroup.visibility.length > 0) {
              const isGroupVisible = modGroup.visibility.includes('TOAST_ONLINE_ORDERING') ||
                                    modGroup.visibility.includes('ORDERING_PARTNERS');
              if (!isGroupVisible) continue;
            }

            const simplifiedModGroup = {
              name: modGroup.name,
              required: modGroup.requiredMode === 'REQUIRED',
              minSelections: modGroup.minSelections || 0,
              maxSelections: modGroup.maxSelections || 999,
              multiSelect: modGroup.isMultiSelect || false,
              options: []
            };

            // Resolve modifier options
            if (modGroup.modifierOptionReferences && modGroup.modifierOptionReferences.length > 0) {
              for (const optionRef of modGroup.modifierOptionReferences) {
                const modOption = modifierOptionsMap[optionRef];
                if (!modOption) continue;

                // Skip hidden options
                if (modOption.visibility && modOption.visibility.length > 0) {
                  const isOptionVisible = modOption.visibility.includes('TOAST_ONLINE_ORDERING') ||
                                         modOption.visibility.includes('ORDERING_PARTNERS');
                  if (!isOptionVisible) continue;
                }

                simplifiedModGroup.options.push({
                  name: modOption.name,
                  price: modOption.price || 0,
                  isDefault: modOption.isDefault || false
                });
              }
            }

            // Only add modifier group if it has options
            if (simplifiedModGroup.options.length > 0) {
              simplifiedItem.modifiers.push(simplifiedModGroup);
            }
          }

          // Remove modifiers array if empty
          if (simplifiedItem.modifiers.length === 0) {
            delete simplifiedItem.modifiers;
          }
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
  let totalModifiers = 0;

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

        // Item name and price
        text += `\n  • ${item.name} - $${price}\n`;

        // Description if available (truncated)
        if (item.description) {
          let description = item.description;
          if (description.length > 80) {
            description = description.substring(0, 77) + '...';
          }
          text += `    ${description}\n`;
        }

        // Modifiers
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modGroup of item.modifiers) {
            totalModifiers++;

            // Modifier group header
            const required = modGroup.required ? '[REQUIRED]' : '[OPTIONAL]';
            const selections = modGroup.multiSelect
              ? `(select ${modGroup.minSelections}-${modGroup.maxSelections})`
              : '(select 1)';

            text += `    ${required} ${modGroup.name} ${selections}:\n`;

            // Modifier options
            for (const option of modGroup.options) {
              const optPrice = option.price || 0;
              const priceStr = optPrice === 0 ? '' : ` (+$${Math.abs(optPrice).toFixed(2)})`;
              const defaultStr = option.isDefault ? ' [DEFAULT]' : '';
              text += `      - ${option.name}${priceStr}${defaultStr}\n`;
            }
          }
        }
      }

      text += `\n`;
    }
  }

  return { text, totalItems, totalModifiers };
}

// Main execution
async function main() {
  const inputPath = path.join(__dirname, '../asset/menu.json');
  const outputJsonPath = path.join(__dirname, '../asset/menu-simplified.json');
  const outputTextPath = path.join(__dirname, '../asset/menu-simplified.txt');

  console.log('Reading Toast menu JSON...');
  const rawData = fs.readFileSync(inputPath, 'utf8');
  const originalSizeKB = Math.round(rawData.length / 1024);
  const lineCount = rawData.split('\n').length;
  console.log(`Original file size: ${originalSizeKB}KB (${lineCount.toLocaleString()} lines)`);

  console.log('\nParsing JSON...');
  const toastMenu = JSON.parse(rawData);

  console.log('\nSimplifying menu structure (including modifiers)...');
  const simplified = simplifyMenu(toastMenu);

  // Write simplified JSON
  const simplifiedJson = JSON.stringify(simplified, null, 2);
  fs.writeFileSync(outputJsonPath, simplifiedJson);
  const simplifiedSizeKB = Math.round(simplifiedJson.length / 1024);
  console.log(`\n✅ Simplified JSON saved: ${outputJsonPath}`);
  console.log(`   Size: ${simplifiedSizeKB}KB (reduced by ${Math.round((1 - simplifiedSizeKB/originalSizeKB) * 100)}%)`);

  // Format as text
  console.log('\nFormatting as plain text...');
  const { text, totalItems, totalModifiers } = formatMenuAsText(simplified, 'Restaurant');
  fs.writeFileSync(outputTextPath, text);
  const textSizeKB = Math.round(text.length / 1024);

  console.log(`\n✅ Text menu saved: ${outputTextPath}`);
  console.log(`   Menu items: ${totalItems}`);
  console.log(`   Modifier groups: ${totalModifiers}`);
  console.log(`   Size: ${textSizeKB}KB`);

  console.log('\n📊 Summary:');
  console.log(`   Original:   ${originalSizeKB}KB`);
  console.log(`   JSON:       ${simplifiedSizeKB}KB (${Math.round((1 - simplifiedSizeKB/originalSizeKB) * 100)}% reduction)`);
  console.log(`   Text:       ${textSizeKB}KB (${Math.round((1 - textSizeKB/originalSizeKB) * 100)}% reduction)`);
  console.log(`   Items:      ${totalItems}`);
  console.log(`   Modifiers:  ${totalModifiers} groups`);

  if (textSizeKB > 100) {
    console.log(`\n⚠️  Warning: Menu is large (${textSizeKB}KB). Bland.ai may have trouble processing it.`);
    console.log('   Consider filtering categories or reducing modifier details.');
  } else if (textSizeKB > 50) {
    console.log(`\n⚠️  Menu is moderately large (${textSizeKB}KB). Should be OK for Bland.ai.`);
  } else {
    console.log(`\n✅ Menu size is good for Bland.ai!`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
