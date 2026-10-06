import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import {
  CategoryBadge,
  CategoryIcon,
  getCategoryColors,
  useIsDark,
} from '#category-appearance';
import { FinancialText } from '#components/FinancialText';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { usePayeesById } from '#hooks/usePayees';
import { useTransactions } from '#hooks/useTransactions';
import * as queries from '#queries';

import { formatRelativeDate } from './overviewCalculations';

export function RecentTransactionsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const isDark = useIsDark();
  const locale = useLocale();
  const navigate = useNavigate();

  const query = useMemo(
    () =>
      queries.transactions('onbudget').options({ splits: 'none' }).select('*'),
    [],
  );

  const { transactions: rawTransactions = [] } = useTransactions({
    query,
    options: { pageSize: 20 },
  });

  const { data: payeesById = {} } = usePayeesById();
  const { data: { list: categories = [] } = {} } = useCategories();

  const transactions = useMemo(() => {
    return rawTransactions
      .filter(trans => {
        // Exclude child transactions
        if (trans.is_child) return false;
        // Exclude transfers between own accounts
        if (trans.transfer_id) return false;
        if (trans.payee && payeesById[trans.payee]?.transfer_acct) return false;
        return true;
      })
      .slice(0, 4);
  }, [rawTransactions, payeesById]);

  const today = monthUtils.currentDay();
  const neutralColors = getCategoryColors('slate', isDark);

  return (
    <View
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 22,
        flexShrink: 0,
        padding: 18,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: theme.pageText,
            letterSpacing: '-0.01em',
          }}
        >
          <Trans>Recent transactions</Trans>
        </Text>
        <NavLink
          to="/transactions"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: theme.buttonPrimaryBackground,
            textDecoration: 'none',
          }}
        >
          <Trans>Show all</Trans>
        </NavLink>
      </View>

      {transactions.length === 0 ? (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 0',
          }}
        >
          <Text style={{ fontSize: 14, color: theme.pageTextSubdued }}>
            <Trans>No recent transactions</Trans>
          </Text>
        </View>
      ) : (
        <View>
          {transactions.map((trans, index) => {
            const isLast = index === transactions.length - 1;
            const category = trans.category
              ? categories.find(c => c.id === trans.category)
              : undefined;

            let payeeName = '';
            if (trans.starting_balance_flag) {
              payeeName = t('Starting balance');
            } else if (trans.payee && payeesById[trans.payee]?.name) {
              payeeName = payeesById[trans.payee].name;
            } else if (trans.imported_payee) {
              payeeName = trans.imported_payee;
            } else {
              payeeName = t('No payee');
            }

            let categoryName = '';
            if (category) {
              categoryName = category.name;
            } else if (trans.is_parent) {
              categoryName = t('Split');
            } else if (trans.amount > 0) {
              categoryName = t('Income');
            } else {
              categoryName = t('Uncategorized');
            }

            const relDate = formatRelativeDate(trans.date, today, locale);

            let badge;
            if (category && !category.is_income) {
              badge = <CategoryBadge category={category} size={40} />;
            } else if (category?.is_income || trans.amount > 0) {
              badge = (
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
                  <CategoryIcon icon="salary" size={22} />
                </div>
              );
            } else {
              badge = (
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

            return (
              <Button
                key={trans.id}
                variant="bare"
                aria-label={t('View transaction {{payee}}', {
                  payee: payeeName,
                })}
                onPress={() => navigate(`/transactions/${trans.id}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: '100%',
                  padding: '10px 0',
                  minHeight: 48,
                  borderBottom: isLast
                    ? 'none'
                    : `1px solid ${theme.tableBorder}`,
                  textAlign: 'left',
                }}
              >
                <div style={{ marginRight: 12, flexShrink: 0 }}>{badge}</div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
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
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.pageTextSubdued,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}
                  >
                    {categoryName} ·{' '}
                    {relDate.type === 'today' ? (
                      <Trans>Today</Trans>
                    ) : relDate.type === 'yesterday' ? (
                      <Trans>Yesterday</Trans>
                    ) : (
                      relDate.formatted
                    )}
                  </Text>
                </div>

                <div
                  style={{
                    marginLeft: 12,
                    display: 'flex',
                    alignItems: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <FinancialText
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color:
                        trans.amount > 0
                          ? theme.numberPositive
                          : theme.pageText,
                    }}
                  >
                    {format(trans.amount, 'financial')}
                  </FinancialText>
                </div>
              </Button>
            );
          })}
        </View>
      )}
    </View>
  );
}
