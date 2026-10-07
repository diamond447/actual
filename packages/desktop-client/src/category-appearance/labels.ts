import { useTranslation } from 'react-i18next';

import type { CategoryColorId } from './categoryColors';
import type { CategoryIconId } from './icons';

/** Translated names for icons and colors, for screen readers. */
export function useCategoryAppearanceLabels() {
  const { t } = useTranslation();

  const colorLabels: Record<CategoryColorId, string> = {
    green: t('Green'),
    blue: t('Blue'),
    amber: t('Amber'),
    orange: t('Orange'),
    pink: t('Pink'),
    purple: t('Purple'),
    olive: t('Olive'),
    slate: t('Gray'),
    teal: t('Teal'),
    red: t('Red'),
  };

  const iconLabels: Record<CategoryIconId, string> = {
    cart: t('Shopping cart'),
    restaurant: t('Restaurant'),
    coffee: t('Coffee'),
    home: t('Home'),
    repair: t('Repairs'),
    bolt: t('Energy'),
    water: t('Water'),
    bus: t('Public transport'),
    car: t('Car'),
    fuel: t('Fuel'),
    plane: t('Travel'),
    heart: t('Health'),
    pill: t('Pharmacy'),
    sport: t('Sport'),
    beauty: t('Beauty'),
    ticket: t('Entertainment'),
    game: t('Games'),
    music: t('Music'),
    film: t('Film'),
    shirt: t('Clothing'),
    gift: t('Gift'),
    book: t('Education'),
    kids: t('Kids'),
    pet: t('Pets'),
    phone: t('Phone'),
    wifi: t('Internet'),
    receipt: t('Bills'),
    shield: t('Insurance'),
    piggy: t('Savings'),
    wallet: t('Wallet'),
    salary: t('Salary'),
    cash: t('Cash'),
    tag: t('Other'),
  };

  return { colorLabels, iconLabels };
}
