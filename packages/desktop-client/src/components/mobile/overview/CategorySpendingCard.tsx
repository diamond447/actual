import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import {
  getCategoryColors,
  parseCategoryAppearance,
  useIsDark,
} from '#category-appearance';
import { FinancialText } from '#components/FinancialText';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSelector } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { groupTopCategories, parseCategorySpent } from './overviewCalculations';
import type { BudgetType } from './overviewCalculations';

type CategorySpendingCardProps = {
  month: string;
  budgetType: BudgetType;
};

export function CategorySpendingCard({
  month,
  budgetType,
}: CategorySpendingCardProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const isDark = useIsDark();
  const spreadsheet = useSpreadsheet();

  const { data: { list: categories = [] } = {} } = useCategories();
  const allSyncedPrefs = useSelector(state => state.prefs.synced);

  const expenseCategories = useMemo(
    () => categories.filter(c => !c.is_income && !c.hidden),
    [categories],
  );

  const [spentByCategoryId, setSpentByCategoryId] = useState<
    Record<string, number>
  >({});

  const sheetName = monthUtils.sheetForMonth(month);

  useEffect(() => {
    setSpentByCategoryId({});

    const unbinds = expenseCategories.map(cat => {
      const bindingName =
        budgetType === 'tracking'
          ? trackingBudget.catSumAmount(cat.id)
          : envelopeBudget.catSumAmount(cat.id);

      return spreadsheet.bind(sheetName, bindingName, result => {
        const spent = parseCategorySpent(result.value as number | null);
        setSpentByCategoryId(prev => {
          if (prev[cat.id] === spent) return prev;
          return { ...prev, [cat.id]: spent };
        });
      });
    });

    return () => {
      unbinds.forEach(unbind => unbind());
    };
  }, [expenseCategories, sheetName, spreadsheet, budgetType]);

  const items = useMemo(() => {
    const rawItems = expenseCategories.map(cat => {
      const prefValue = allSyncedPrefs[`category-appearance-${cat.id}`];
      const { color } = parseCategoryAppearance(prefValue, cat.name, cat.id);
      const { fg } = getCategoryColors(color, isDark);
      return {
        id: cat.id,
        name: cat.name,
        amount: spentByCategoryId[cat.id] ?? 0,
        color: fg,
      };
    });

    const otherColor = getCategoryColors('slate', isDark).fg;
    return groupTopCategories(rawItems, t('Other'), otherColor);
  }, [expenseCategories, spentByCategoryId, allSyncedPrefs, isDark, t]);

  // The chart shows the categories it lists, so its total is their sum
  const totalSpent = items.reduce((sum, item) => sum + item.amount, 0);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const segments = items.map(item => {
    const fraction = totalSpent > 0 ? item.amount / totalSpent : 0;
    const length = fraction * circumference;
    const dasharray = `0 ${currentOffset} ${length} ${circumference}`;
    currentOffset += length;
    return {
      ...item,
      dasharray,
    };
  });

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
          marginBottom: 14,
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
          <Trans>Spending by category</Trans>
        </Text>
        <NavLink
          to="/budget"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: theme.buttonPrimaryBackground,
            textDecoration: 'none',
          }}
        >
          <Trans>Budget</Trans>
        </NavLink>
      </View>

      {items.length === 0 ? (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
        >
          <Text style={{ fontSize: 14, color: theme.pageTextSubdued }}>
            <Trans>No spending this month</Trans>
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Donut Chart (SVG) */}
          <div
            style={{
              position: 'relative',
              width: 132,
              height: 132,
              minWidth: 132,
              minHeight: 132,
            }}
          >
            <svg width={132} height={132} viewBox="0 0 132 132">
              {segments.map(seg => (
                <circle
                  key={seg.id}
                  cx={66}
                  cy={66}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={16}
                  strokeDasharray={seg.dasharray}
                  transform="rotate(-90 66 66)"
                />
              ))}
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                pointerEvents: 'none',
                padding: 10,
              }}
            >
              <FinancialText
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: theme.pageText,
                  maxWidth: 76,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {format(totalSpent, 'financial')}
              </FinancialText>
            </div>
          </div>

          {/* Legend */}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 8,
            }}
          >
            {items.map(item => (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    minWidth: 8,
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    marginRight: 8,
                    flexShrink: 0,
                  }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: theme.pageText,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    ...styles.tnum,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.pageTextSubdued,
                    marginLeft: 6,
                    flexShrink: 0,
                  }}
                >
                  {item.percentage}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
