import type { Locator, Page } from '@playwright/test';

import { MobileAccountPage } from './mobile-account-page';
import { MobileAccountsPage } from './mobile-accounts-page';
import { MobileBankSyncPage } from './mobile-bank-sync-page';
import { MobileBudgetPage } from './mobile-budget-page';
import { MobilePayeesPage } from './mobile-payees-page';
import { MobileReportsPage } from './mobile-reports-page';
import { MobileRulesPage } from './mobile-rules-page';
import { MobileSchedulesPage } from './mobile-schedules-page';
import { MobileTransactionEntryPage } from './mobile-transaction-entry-page';
import { SettingsPage } from './settings-page';

// Pages reached through the tab bar's "More" sheet rather than a tab.
const PAGES_IN_MORE_SHEET = [
  'Reports',
  'Schedules',
  'Payees',
  'Rules',
  'Bank Sync',
  'Settings',
];
const LINK_NAME_BY_PAGE: Partial<Record<keyof typeof ROUTES_BY_PAGE, string>> =
  {
    Transaction: 'Add transaction',
  };
const ROUTES_BY_PAGE = {
  Budget: '/budget',
  Accounts: '/accounts',
  Transaction: '/transactions/new',
  Reports: '/reports',
  Schedules: '/schedules',
  Payees: '/payees',
  Rules: '/rules',
  'Bank Sync': '/bank-sync',
  Settings: '/settings',
};

export class MobileNavigation {
  readonly page: Page;
  readonly heading: Locator;
  readonly navbar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading');
    this.navbar = page.getByRole('navigation', { name: 'Main navigation' });
  }

  async navigateToPage<T extends { waitFor: Locator['waitFor'] }>(
    pageName: keyof typeof ROUTES_BY_PAGE,
    pageModelFactory: () => T,
  ): Promise<T> {
    const pageInstance = pageModelFactory();

    if (this.page.url().endsWith(ROUTES_BY_PAGE[pageName])) {
      // Already on the page.
      return pageInstance;
    }

    await this.navbar.waitFor();

    const linkName = LINK_NAME_BY_PAGE[pageName] ?? pageName;
    if (PAGES_IN_MORE_SHEET.includes(pageName)) {
      await this.navbar.getByRole('button', { name: 'More' }).click();
      await this.page
        .getByRole('dialog', { name: 'More' })
        .getByRole('link', { name: linkName })
        .click();
    } else {
      await this.navbar.getByRole('link', { name: linkName }).click();
    }

    await pageInstance.waitFor();

    return pageInstance;
  }

  async goToBudgetPage() {
    return await this.navigateToPage(
      'Budget',
      () => new MobileBudgetPage(this.page),
    );
  }

  async goToAccountsPage() {
    return await this.navigateToPage(
      'Accounts',
      () => new MobileAccountsPage(this.page),
    );
  }

  async goToUncategorizedPage() {
    const button = this.page.getByRole('button', { name: 'Categorize' });
    await button.click();

    return new MobileAccountPage(this.page);
  }

  async goToTransactionEntryPage() {
    return await this.navigateToPage(
      'Transaction',
      () => new MobileTransactionEntryPage(this.page),
    );
  }

  async goToReportsPage() {
    return await this.navigateToPage(
      'Reports',
      () => new MobileReportsPage(this.page),
    );
  }

  async goToPayeesPage() {
    return await this.navigateToPage(
      'Payees',
      () => new MobilePayeesPage(this.page),
    );
  }

  async goToSchedulesPage() {
    return this.navigateToPage(
      'Schedules',
      () => new MobileSchedulesPage(this.page),
    );
  }

  async goToRulesPage() {
    return await this.navigateToPage(
      'Rules',
      () => new MobileRulesPage(this.page),
    );
  }

  async goToBankSyncPage() {
    return await this.navigateToPage(
      'Bank Sync',
      () => new MobileBankSyncPage(this.page),
    );
  }

  async goToSettingsPage() {
    return await this.navigateToPage(
      'Settings',
      () => new SettingsPage(this.page),
    );
  }
}
