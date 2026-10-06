import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { SvgSplit } from '@actual-app/components/icons/v0';
import {
  SvgArrowThinLeft,
  SvgArrowThinRight,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { groupById } from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import {
  CategoryBadge,
  CategoryIcon,
  getCategoryColors,
  useIsDark,
} from '#category-appearance';
import { Search } from '#components/common/Search';
import { FinancialText } from '#components/FinancialText';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import type { FormatType } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { usePayeesById } from '#hooks/usePayees';
import { useTransactions } from '#hooks/useTransactions';
import { useUrlParam } from '#hooks/useUrlParam';

import {
  calculateMonthTotals,
  filterTransactions,
  formatCategoryAndNotes,
  formatDayHeader,
  getCategoryDisplay,
  getPayeeDisplay,
  groupTransactionsByDay,
} from './transactionsFeedHelper';
import type { DayGroup, TransactionFilterType } from './transactionsFeedHelper';

export function TransactionsFeedPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const navigate = useNavigate();

  const [monthParam, setMonthParam] = useUrlParam('month');
  const currentMonth = monthUtils.currentMonth();
  const month =
    monthParam && monthUtils.isValidYearMonth(monthParam)
      ? monthParam
      : currentMonth;

  // Ensure ?month=YYYY-MM is preserved in URL for back navigation
  useEffect(() => {
    if (!monthParam) {
      setMonthParam(currentMonth, { replace: true });
    }
  }, [monthParam, currentMonth, setMonthParam]);

  const onPrevMonth = () => {
    setMonthParam(monthUtils.prevMonth(month));
  };

  const onNextMonth = () => {
    setMonthParam(monthUtils.nextMonth(month));
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TransactionFilterType>('all');

  const startDate = monthUtils.firstDayOfMonth(month);
  const endDate = monthUtils.lastDayOfMonth(month);

  const transactionsQuery = useMemo(
    () =>
      q('transactions')
        .filter({
          'account.offbudget': false,
          date: { $gte: startDate, $lte: endDate },
        })
        .options({ splits: 'grouped' })
        .select('*'),
    [startDate, endDate],
  );

  const {
    transactions = [],
    isPending: isLoading,
    isFetchingNextPage: isLoadingMore,
    hasNextPage,
    fetchNextPage,
  } = useTransactions({
    query: transactionsQuery,
    options: {
      pageSize: 200,
    },
  });

  // Automatically fetch remaining pages for the month
  useEffect(() => {
    if (hasNextPage && !isLoadingMore) {
      void fetchNextPage();
    }
  }, [hasNextPage, isLoadingMore, fetchNextPage]);

  const { data: accounts = [] } = useAccounts();
  const { data: { list: categories = [] } = {} } = useCategories();
  const { data: payeesById = {} } = usePayeesById();

  const accountsById = useMemo(() => groupById(accounts), [accounts]);
  const categoriesById = useMemo(() => groupById(categories), [categories]);

  const helperContext = useMemo(
    () => ({
      payeesById,
      categoriesById,
      accountsById,
    }),
    [payeesById, categoriesById, accountsById],
  );

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, filterType, searchTerm, helperContext),
    [transactions, filterType, searchTerm, helperContext],
  );

  const monthTotals = calculateMonthTotals(filteredTransactions, t => {
    const transferAccountId = t.payee
      ? payeesById[t.payee]?.transfer_acct
      : undefined;
    return (
      !!transferAccountId && accountsById[transferAccountId]?.offbudget === 0
    );
  });

  const dayGroups = useMemo(
    () => groupTransactionsByDay(filteredTransactions),
    [filteredTransactions],
  );

  return (
    <Page
      padding={0}
      header={
        <TransactionsHeader
          month={month}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
        />
      }
    >
      <View
        style={{
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 12,
          paddingBottom: MOBILE_NAV_HEIGHT + 16,
          flexShrink: 0,
          backgroundColor: theme.mobilePageBackground,
        }}
      >
        <View style={{ marginBottom: 12 }}>
          <Search
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('Search payee, category, notes...')}
            width="100%"
            height={40}
            style={{
              backgroundColor: theme.tableBackground,
              borderColor: theme.tableBorder,
              borderRadius: 14,
            }}
          />
        </View>

        <FilterChips
          selectedFilter={filterType}
          onSelectFilter={setFilterType}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
            <Trans>Spent:</Trans>{' '}
            <FinancialText style={{ fontWeight: 700, color: theme.pageText }}>
              {format(monthTotals.spent, 'financial')}
            </FinancialText>
          </Text>
          <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
            <Trans>Received:</Trans>{' '}
            <FinancialText
              style={{
                fontWeight: 700,
                color: theme.numberPositive,
              }}
            >
              {format(monthTotals.received, 'financial')}
            </FinancialText>
          </Text>
        </View>

        {isLoading && transactions.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
            }}
          >
            <AnimatedLoading width={25} height={25} />
          </View>
        ) : dayGroups.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 16px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: theme.pageTextSubdued,
              }}
            >
              {searchTerm.trim() ? (
                <Trans>Nothing matches your search</Trans>
              ) : (
                <Trans>No transactions in this month</Trans>
              )}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {dayGroups.map(group => (
              <DayGroupCard
                key={group.date}
                group={group}
                helperContext={helperContext}
                format={format}
                locale={locale}
                onSelectTransaction={id => navigate(`/transactions/${id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}

type TransactionsHeaderProps = {
  month: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function TransactionsHeader({
  month,
  onPrevMonth,
  onNextMonth,
}: TransactionsHeaderProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 50,
        paddingLeft: 16,
        paddingRight: 8,
        backgroundColor: theme.mobileHeaderBackground,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: theme.mobileHeaderText,
        }}
      >
        <Trans>Transactions</Trans>
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Button
          variant="bare"
          aria-label={t('Previous month')}
          onPress={onPrevMonth}
          style={arrowButtonStyle}
        >
          <SvgArrowThinLeft width={16} height={16} />
        </Button>
        <Text
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: theme.mobileHeaderText,
            textAlign: 'center',
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          {monthUtils.format(month, "MMMM ''yy", locale)}
        </Text>
        <Button
          variant="bare"
          aria-label={t('Next month')}
          onPress={onNextMonth}
          style={arrowButtonStyle}
        >
          <SvgArrowThinRight width={16} height={16} />
        </Button>
      </View>
    </View>
  );
}

const arrowButtonStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.mobileHeaderText,
};

type FilterChipsProps = {
  selectedFilter: TransactionFilterType;
  onSelectFilter: (filter: TransactionFilterType) => void;
};

function FilterChips({ selectedFilter, onSelectFilter }: FilterChipsProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
      }}
    >
      <FilterChip
        type="all"
        isSelected={selectedFilter === 'all'}
        onSelect={() => onSelectFilter('all')}
      >
        <Trans>All</Trans>
      </FilterChip>
      <FilterChip
        type="expenses"
        isSelected={selectedFilter === 'expenses'}
        onSelect={() => onSelectFilter('expenses')}
      >
        <Trans>Expenses</Trans>
      </FilterChip>
      <FilterChip
        type="income"
        isSelected={selectedFilter === 'income'}
        onSelect={() => onSelectFilter('income')}
      >
        <Trans>Income</Trans>
      </FilterChip>
    </View>
  );
}

type FilterChipProps = {
  type: TransactionFilterType;
  isSelected: boolean;
  onSelect: () => void;
  children: ReactNode;
};

function FilterChip({ isSelected, onSelect, children }: FilterChipProps) {
  return (
    <Button
      variant="bare"
      aria-pressed={isSelected}
      onPress={onSelect}
      style={{
        ...styles.noTapHighlight,
        height: 36,
        borderRadius: 18,
        padding: '0 16px',
        fontSize: 14,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backgroundColor: isSelected ? theme.pageText : theme.tableBackground,
        color: isSelected ? theme.mobilePageBackground : theme.pageText,
        border: isSelected ? 'none' : `1px solid ${theme.tableBorder}`,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </Button>
  );
}

type DayGroupCardProps = {
  group: DayGroup;
  helperContext: {
    payeesById: Record<string, PayeeEntity>;
    categoriesById: Record<string, CategoryEntity>;
    accountsById: Record<string, AccountEntity>;
  };
  format: (value: unknown, type?: FormatType) => string;
  locale: ReturnType<typeof useLocale>;
  onSelectTransaction: (id: string) => void;
};

function DayGroupCard({
  group,
  helperContext,
  format,
  locale,
  onSelectTransaction,
}: DayGroupCardProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 4px 6px',
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: theme.pageTextSubdued,
            letterSpacing: '0.02em',
          }}
        >
          {formatDayHeader(group.date, locale, t)}
        </Text>
        <FinancialText
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.pageTextSubdued,
          }}
        >
          {format(group.dayTotal, 'financial')}
        </FinancialText>
      </View>

      <View
        style={{
          backgroundColor: theme.tableBackground,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {group.transactions.map((transaction, index) => (
          <TransactionFeedRow
            key={transaction.id}
            transaction={transaction}
            isLast={index === group.transactions.length - 1}
            helperContext={helperContext}
            format={format}
            onSelect={() => onSelectTransaction(transaction.id)}
          />
        ))}
      </View>
    </View>
  );
}

type TransactionFeedRowProps = {
  transaction: TransactionEntity;
  isLast: boolean;
  helperContext: {
    payeesById: Record<string, PayeeEntity>;
    categoriesById: Record<string, CategoryEntity>;
    accountsById: Record<string, AccountEntity>;
  };
  format: (value: unknown, type?: FormatType) => string;
  onSelect: () => void;
};

function TransactionFeedRow({
  transaction,
  isLast,
  helperContext,
  format,
  onSelect,
}: TransactionFeedRowProps) {
  const { t } = useTranslation();

  const payeeName = getPayeeDisplay(
    transaction,
    helperContext.payeesById,
    helperContext.accountsById,
    t,
  );

  const categoryDisplay = getCategoryDisplay(
    transaction,
    helperContext.categoriesById,
    t,
  );

  const subtitle = formatCategoryAndNotes(
    categoryDisplay.name,
    transaction.notes,
  );

  const formattedAmount = format(transaction.amount, 'financial');
  const isIncome = transaction.amount > 0;

  return (
    <Button
      variant="bare"
      onPress={onSelect}
      aria-label={t('Transaction: {{payee}}, {{amount}}', {
        payee: payeeName,
        amount: formattedAmount,
      })}
      style={{
        ...styles.noTapHighlight,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        minHeight: 56,
        padding: '10px 14px',
        boxSizing: 'border-box',
        textAlign: 'left',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 0,
        cursor: 'pointer',
        ...(!isLast && {
          borderBottom: `1px solid ${theme.tableBorder}`,
        }),
      }}
    >
      <TransactionBadge
        category={categoryDisplay.category}
        isSplit={categoryDisplay.isSplit}
        isUncategorized={categoryDisplay.isUncategorized}
      />

      <View
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: 12,
          marginRight: 12,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: theme.pageText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {payeeName}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: 13,
              color: theme.pageTextSubdued,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <FinancialText
        style={{
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'right',
          flexShrink: 0,
          color: isIncome ? theme.numberPositive : theme.pageText,
        }}
      >
        {formattedAmount}
      </FinancialText>
    </Button>
  );
}

type TransactionBadgeProps = {
  category?: CategoryEntity;
  isSplit: boolean;
  isUncategorized: boolean;
};

function TransactionBadge({ category, isSplit }: TransactionBadgeProps) {
  const isDark = useIsDark();
  const neutralColors = getCategoryColors('slate', isDark);

  if (isSplit) {
    return (
      <div
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          minHeight: 40,
          borderRadius: 13,
          backgroundColor: neutralColors.bg,
          color: neutralColors.fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <SvgSplit width={22} height={22} />
      </div>
    );
  }

  if (category) {
    return <CategoryBadge category={category} size={40} />;
  }

  // Uncategorized neutral badge
  return (
    <div
      style={{
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        borderRadius: 13,
        backgroundColor: neutralColors.bg,
        color: neutralColors.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <CategoryIcon icon="tag" size={22} />
    </div>
  );
}
