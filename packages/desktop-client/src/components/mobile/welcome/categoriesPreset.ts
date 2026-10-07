import type { CategoryColorId, CategoryIconId } from '#category-appearance';

export type PresetCategory = {
  id: string;
  name: string;
  icon: CategoryIconId;
  color: CategoryColorId;
  defaultSelected: boolean;
};

export const PRESET_EXPENSE_CATEGORIES: readonly PresetCategory[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    icon: 'cart',
    color: 'green',
    defaultSelected: true,
  },
  {
    id: 'housing',
    name: 'Housing',
    icon: 'home',
    color: 'blue',
    defaultSelected: true,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: 'bolt',
    color: 'olive',
    defaultSelected: true,
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: 'bus',
    color: 'amber',
    defaultSelected: true,
  },
  {
    id: 'car',
    name: 'Car',
    icon: 'car',
    color: 'slate',
    defaultSelected: false,
  },
  {
    id: 'restaurants',
    name: 'Restaurants',
    icon: 'restaurant',
    color: 'orange',
    defaultSelected: true,
  },
  {
    id: 'health',
    name: 'Health',
    icon: 'heart',
    color: 'pink',
    defaultSelected: true,
  },
  {
    id: 'clothing',
    name: 'Clothing',
    icon: 'shirt',
    color: 'slate',
    defaultSelected: true,
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: 'ticket',
    color: 'purple',
    defaultSelected: true,
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    icon: 'receipt',
    color: 'purple',
    defaultSelected: false,
  },
  {
    id: 'gifts',
    name: 'Gifts',
    icon: 'gift',
    color: 'red',
    defaultSelected: false,
  },
  {
    id: 'kids',
    name: 'Kids',
    icon: 'kids',
    color: 'teal',
    defaultSelected: false,
  },
  {
    id: 'pets',
    name: 'Pets',
    icon: 'pet',
    color: 'amber',
    defaultSelected: false,
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: 'plane',
    color: 'blue',
    defaultSelected: false,
  },
  {
    id: 'savings',
    name: 'Savings',
    icon: 'piggy',
    color: 'teal',
    defaultSelected: true,
  },
  {
    id: 'other',
    name: 'Other',
    icon: 'tag',
    color: 'slate',
    defaultSelected: true,
  },
] as const;

export const PRESET_SALARY_CATEGORY = {
  id: 'salary',
  name: 'Salary',
  icon: 'salary' as const,
  color: 'teal' as const,
};
