import { useEffect, useState } from 'react';

import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { prewarmMonth } from '#components/budget/util';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { Page } from '#components/Page';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { CategorySpendingCard } from './CategorySpendingCard';
import { HeroCard } from './HeroCard';
import { isBudgetType } from './overviewCalculations';
import { OverviewHeader } from './OverviewHeader';
import { RecentTransactionsCard } from './RecentTransactionsCard';

export function OverviewPage() {
  const [month, setMonth] = useState(() => monthUtils.currentMonth());
  const [budgetTypePref] = useSyncedPref('budgetType');
  // Same default as the budget page: no pref means an envelope budget
  const budgetType = isBudgetType(budgetTypePref) ? budgetTypePref : 'envelope';
  const spreadsheet = useSpreadsheet();

  useEffect(() => {
    void prewarmMonth(budgetType, spreadsheet, month);
  }, [budgetType, month, spreadsheet]);

  return (
    <Page
      header={
        <OverviewHeader
          month={month}
          onPrevMonth={() => setMonth(m => monthUtils.prevMonth(m))}
          onNextMonth={() => setMonth(m => monthUtils.nextMonth(m))}
        />
      }
      padding={16}
    >
      <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
        <View
          style={{
            paddingBottom: MOBILE_NAV_HEIGHT,
            paddingTop: 8,
            flexShrink: 0,
            gap: 16,
          }}
        >
          <HeroCard month={month} budgetType={budgetType} />

          <CategorySpendingCard month={month} budgetType={budgetType} />

          <RecentTransactionsCard />
        </View>
      </SheetNameProvider>
    </Page>
  );
}
