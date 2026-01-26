'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [restaurantId] = useState('demo-restaurant-id');

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      // In production, this would fetch from your API
      // For now, using demo data
      setMenu([
        {
          name: 'Appetizers',
          items: [
            {
              id: 'app1',
              name: 'Mozzarella Sticks',
              price: 8.99,
              description: '6 pieces with marinara sauce',
            },
            {
              id: 'app2',
              name: 'Wings',
              price: 12.99,
              description: '10 wings with your choice of sauce',
            },
          ],
        },
        {
          name: 'Entrees',
          items: [
            {
              id: 'ent1',
              name: 'Margherita Pizza',
              price: 14.99,
              description: 'Fresh mozzarella, basil, tomato sauce',
            },
            {
              id: 'ent2',
              name: 'Chicken Parmesan',
              price: 16.99,
              description: 'Breaded chicken with marinara and cheese',
            },
          ],
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMenu = async () => {
    try {
      // Save menu to backend
      const response = await fetch('/api/restaurants/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          menu: { categories: menu },
        }),
      });

      if (response.ok) {
        alert('Menu updated successfully!');
      }
    } catch (error) {
      console.error('Failed to save menu:', error);
      alert('Failed to save menu');
    }
  };

  const handleAddCategory = () => {
    const categoryName = prompt('Enter category name:');
    if (categoryName) {
      setMenu([...menu, { name: categoryName, items: [] }]);
    }
  };

  const handleAddItem = (categoryIndex: number) => {
    const name = prompt('Item name:');
    if (!name) return;

    const priceStr = prompt('Price:');
    if (!priceStr) return;

    const description = prompt('Description (optional):');

    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      name,
      price: parseFloat(priceStr),
      description: description || undefined,
    };

    const newMenu = [...menu];
    newMenu[categoryIndex].items.push(newItem);
    setMenu(newMenu);
  };

  const handleDeleteItem = (categoryIndex: number, itemIndex: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const newMenu = [...menu];
      newMenu[categoryIndex].items.splice(itemIndex, 1);
      setMenu(newMenu);
    }
  };

  const handleDeleteCategory = (categoryIndex: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      const newMenu = [...menu];
      newMenu.splice(categoryIndex, 1);
      setMenu(newMenu);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 mt-1">
            Manage your restaurant menu items and pricing
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleAddCategory} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </button>
          <button onClick={handleSaveMenu} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Menu
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {menu.map((category, categoryIndex) => (
          <div key={category.name} className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{category.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddItem(categoryIndex)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
                <button
                  onClick={() => handleDeleteCategory(categoryIndex)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {category.items.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <span className="text-lg font-semibold text-primary-600">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="text-gray-600 hover:text-gray-700 p-2">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(categoryIndex, itemIndex)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {category.items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No items in this category. Click "Add Item" to get started.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {menu.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No menu categories yet</p>
          <button onClick={handleAddCategory} className="btn-primary">
            Create First Category
          </button>
        </div>
      )}
    </div>
  );
}
