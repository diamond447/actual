import { Trans } from 'react-i18next';
import { NavLink } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import {
  calculateDaysLeft,
  parseHeroBudgetValues,
} from './overviewCalculations';
import type { BudgetType } from './overviewCalculations';

type HeroCardProps = {
  month: string;
  budgetType: BudgetType;
};

export function HeroCard({ month, budgetType }: HeroCardProps) {
  const format = useFormat();

  const rawSpent = useSheetValue<
    'envelope-budget' | 'tracking-budget',
    'total-spent'
  >(
    budgetType === 'tracking'
      ? trackingBudget.totalSpent
      : envelopeBudget.totalSpent,
  );
  const rawBudgeted = useSheetValue<
    'envelope-budget' | 'tracking-budget',
    'total-budgeted'
  >(
    budgetType === 'tracking'
      ? trackingBudget.totalBudgetedExpense
      : envelopeBudget.totalBudgeted,
  );

  const { spent, budgeted, left, isOverbudget, progressPercent, hasBudget } =
    parseHeroBudgetValues(rawSpent, rawBudgeted, budgetType);

  const daysLeft = calculateDaysLeft(month);

  return (
    <View
      style={{
        backgroundColor: theme.buttonPrimaryBackground,
        color: theme.buttonPrimaryText,
        borderRadius: 22,
        flexShrink: 0,
        padding: 20,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: 600,
          opacity: 0.85,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Trans>Spent this month</Trans>
      </Text>

      <FinancialText
        style={{
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '4px 0 8px',
        }}
      >
        {format(spent, 'financial')}
      </FinancialText>

      {hasBudget ? (
        <>
          <Text style={{ fontSize: 15, opacity: 0.9 }}>
            <Trans>
              of{' '}
              <FinancialText style={{ fontWeight: 700 }}>
                {format(budgeted, 'financial')}
              </FinancialText>{' '}
              budgeted
            </Trans>
          </Text>

          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              overflow: 'hidden',
              margin: '14px 0 16px',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: '#ffffff',
                borderRadius: 4,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 500 }}>
              {isOverbudget ? (
                <Trans>
                  <FinancialText style={{ fontWeight: 700 }}>
                    {format(left, 'financial')}
                  </FinancialText>{' '}
                  over budget
                </Trans>
              ) : (
                <Trans>
                  <FinancialText style={{ fontWeight: 700 }}>
                    {format(left, 'financial')}
                  </FinancialText>{' '}
                  left
                </Trans>
              )}
            </Text>

            {daysLeft != null && (
              <Text style={{ fontSize: 14, fontWeight: 500 }}>
                <Trans count={daysLeft}>{{ count: daysLeft }} days left</Trans>
              </Text>
            )}
          </View>
        </>
      ) : (
        <View
          style={{
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 14, opacity: 0.95 }}>
            <Trans>No budget set for this month.</Trans>{' '}
            <NavLink
              to="/budget"
              style={{
                color: theme.buttonPrimaryText,
                fontWeight: 700,
                textDecoration: 'underline',
              }}
            >
              <Trans>Go to Budget</Trans>
            </NavLink>
          </Text>
        </View>
      )}
    </View>
  );
}
