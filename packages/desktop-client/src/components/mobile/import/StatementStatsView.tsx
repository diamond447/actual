import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { FinancialText } from '#components/FinancialText';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import type { StatementStats } from '#pdf-import/statementStats';

type StatementStatsViewProps = {
  stats: StatementStats;
  categoryNames: Map<string, string>;
};

/** Statistics of one imported statement: totals, categories, payees. */
export function StatementStatsView({
  stats,
  categoryNames,
}: StatementStatsViewProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const net = stats.income - stats.expenses;
  const largestCategory = stats.expensesByCategory[0]?.amount ?? 0;

  return (
    <View style={{ padding: 15, gap: 18 }}>
      {stats.firstDate && stats.lastDate && (
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans count={stats.count}>
            {{ count: stats.count }} transactions from{' '}
            {{ from: monthUtils.format(stats.firstDate, dateFormat) }} to{' '}
            {{ to: monthUtils.format(stats.lastDate, dateFormat) }}
          </Trans>
        </Text>
      )}

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        <StatTile
          label={t('Income')}
          value={format(stats.income, 'financial')}
        />
        <StatTile
          label={t('Expenses')}
          value={format(stats.expenses, 'financial')}
        />
        <StatTile label={t('Net')} value={format(net, 'financial-with-sign')} />
      </View>

      {stats.expensesByCategory.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontWeight: 700, fontSize: 16 }}>
            <Trans>Expenses by category</Trans>
          </Text>
          {stats.expensesByCategory.map(item => (
            <View key={item.categoryId ?? 'none'} style={{ gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: 600 }}>
                  {item.categoryId
                    ? (categoryNames.get(item.categoryId) ?? t('Unknown'))
                    : t('Uncategorized')}
                </Text>
                <Text style={{ color: theme.pageTextSubdued }}>
                  <FinancialText style={{ color: theme.pageText }}>
                    {format(item.amount, 'financial')}
                  </FinancialText>
                  {' · '}
                  {Math.round(item.share * 100)} %
                </Text>
              </View>
              <View
                aria-hidden
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.tableBorder,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    width: `${(item.amount / largestCategory) * 100}%`,
                    backgroundColor: theme.reportsBlue,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {stats.topPayees.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: 700, fontSize: 16 }}>
            <Trans>Where the money went</Trans>
          </Text>
          {stats.topPayees.map(payee => (
            <View
              key={payee.name}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Text style={{ minWidth: 0, ...styles.lineClamp(1) }}>
                {payee.name}
                {payee.count > 1 && (
                  <Text style={{ color: theme.pageTextSubdued }}>
                    {' '}
                    ×{payee.count}
                  </Text>
                )}
              </Text>
              <FinancialText style={{ fontWeight: 600, flexShrink: 0 }}>
                {format(payee.amount, 'financial')}
              </FinancialText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        gap: 4,
      }}
    >
      <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
        {label}
      </Text>
      <FinancialText style={{ fontWeight: 700, fontSize: 15 }}>
        {value}
      </FinancialText>
    </View>
  );
}
