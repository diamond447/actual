import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import {
  amountToInteger,
  currencyToAmount,
} from '@actual-app/core/shared/util';

import { FinancialText } from '#components/FinancialText';
import { Checkbox } from '#components/forms';
import { InputField } from '#components/mobile/MobileForms';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { effectiveAmount } from '#pdf-import/toImportTransactions';
import type { StatementRow } from '#pdf-import/toImportTransactions';

/** An existing transaction the row would be merged with on import. */
export type ExistingMatch = {
  payee: string | null;
  date: string | null;
  /** Integer amount, or null when the import would leave it unchanged */
  amount: number | null;
};

type StatementRowItemProps = {
  row: StatementRow;
  flipSigns: boolean;
  showSignToggle: boolean;
  onChange: (changes: Partial<StatementRow>) => void;
  categoryName: string | null;
  isCategorizing: boolean;
  onPickCategory: () => void;
  match: ExistingMatch | null;
};

export function StatementRowItem({
  row,
  flipSigns,
  showSignToggle,
  onChange,
  categoryName,
  isCategorizing,
  onPickCategory,
  match,
}: StatementRowItemProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [amountText, setAmountText] = useState('');
  const [isIncome, setIsIncome] = useState(false);

  const reasons = new Set(row.reviewReasons);
  const needsAmount = reasons.has('missing-amount');
  const displayAmount = effectiveAmount(row, flipSigns);
  const checkboxId = `statement-row-${row.id}`;

  // Typed amounts are final: the sign comes from the expense/income choice
  // and is not affected by "Flip all signs"
  const setManualAmount = (text: string, income: boolean) => {
    setAmountText(text);
    setIsIncome(income);
    const amount = currencyToAmount(text);
    const magnitude = amount === null ? null : Math.abs(amount);
    onChange({
      amount: magnitude === null ? null : income ? magnitude : -magnitude,
      isAmountManual: true,
      isSelected: magnitude !== null && magnitude !== 0,
    });
  };

  const details = match
    ? [
        match.payee,
        match.date && monthUtils.format(match.date, dateFormat),
        match.amount !== null && format(match.amount, 'financial'),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const notes: Array<{ key: string; text: string; isInfo?: boolean }> = [];
  if (reasons.has('blacked-out-rows')) {
    notes.push({
      key: 'blacked-out',
      isInfo: true,
      text:
        row.amount !== null
          ? t(
              'You blacked these rows out, so they are skipped. Their total comes from the balance on the statement. Tick the row to import it as one transaction.',
            )
          : t(
              'You blacked these rows out, so they are skipped. Their total could not be calculated from the statement.',
            ),
    });
  }
  if (reasons.has('redacted')) {
    notes.push({ key: 'redacted', text: t('Some details are blacked out.') });
  }
  if (reasons.has('uncertain-amount')) {
    notes.push({
      key: 'uncertain',
      text: t(
        'This amount may be the account balance. Check it before importing.',
      ),
    });
  }
  if (reasons.has('amount-from-balance')) {
    notes.push({
      key: 'from-balance',
      text: t(
        'The amount could not be read and was calculated from the account balance on the statement.',
      ),
    });
  }
  if (reasons.has('balance-mismatch')) {
    notes.push({
      key: 'mismatch',
      text: t(
        'The amount does not match the change of the balance on the statement. Check it.',
      ),
    });
  }
  if (reasons.has('unchecked-sign')) {
    notes.push({
      key: 'sign',
      text: t(
        'Rows you blacked out sit right before this one, so its sign could not be checked. Check whether it is an expense or income.',
      ),
    });
  }
  if (reasons.has('date-from-previous-row')) {
    notes.push({
      key: 'date',
      text: t('The row has no date; the date of the row above is used.'),
    });
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 15px',
        borderBottomWidth: 1,
        borderColor: theme.tableBorder,
        backgroundColor: theme.tableBackground,
        opacity: row.isSelected ? 1 : 0.6,
      }}
    >
      <Checkbox
        id={checkboxId}
        checked={row.isSelected}
        disabled={row.amount === null}
        onChange={() => onChange({ isSelected: !row.isSelected })}
        style={{ marginTop: 3 }}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <label htmlFor={checkboxId}>
          <Text style={{ fontWeight: 600, ...styles.lineClamp(2) }}>
            {row.blackedOutRows
              ? t('Blacked-out rows: {{count}}', { count: row.blackedOutRows })
              : row.payee || t('(no description)')}
          </Text>
        </label>
        <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
          {monthUtils.format(row.date, dateFormat)}
          {row.notes && row.notes !== row.payee ? ` · ${row.notes}` : ''}
        </Text>
        <Button
          variant="bare"
          onPress={onPickCategory}
          aria-label={t('Change category')}
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            padding: '4px 10px',
            borderRadius: 12,
            backgroundColor: theme.pillBackground,
            color: categoryName ? theme.pillText : theme.pageTextSubdued,
            ...styles.smallText,
          }}
        >
          {categoryName ??
            (isCategorizing ? t('Finding category…') : t('Choose category'))}
          {row.categorySource === 'guess' && (
            <Text style={{ color: theme.pageTextSubdued }}>
              {' · '}
              <Trans>suggested</Trans>
            </Text>
          )}
        </Button>
        {notes.map(note => (
          <Text
            key={note.key}
            style={{
              color: note.isInfo ? theme.pageTextSubdued : theme.warningText,
              ...styles.smallText,
            }}
          >
            {note.text}
          </Text>
        ))}
        {match && row.isSelected && (
          <View style={{ marginTop: 4, gap: 4 }}>
            <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
              {row.forceAdd ? (
                <Trans>
                  It will be added as a new transaction, although a similar one
                  is already in the account.
                </Trans>
              ) : details ? (
                <>
                  <Trans>Already in the account, it will not be added:</Trans>{' '}
                  {details}
                </>
              ) : (
                <Trans>Already in the account, it will not be added.</Trans>
              )}
            </Text>
            <Button
              variant="bare"
              onPress={() => onChange({ forceAdd: !row.forceAdd })}
              style={{
                alignSelf: 'flex-start',
                color: theme.pageTextLink,
                ...styles.smallText,
              }}
            >
              {row.forceAdd ? (
                <Trans>Do not add it</Trans>
              ) : (
                <Trans>It is a different payment, add it</Trans>
              )}
            </Button>
          </View>
        )}
        {needsAmount && (
          <View style={{ marginTop: 6, gap: 6 }}>
            <Text style={{ color: theme.warningText, ...styles.smallText }}>
              <Trans>
                The amount could not be read. Type it in to import this
                transaction.
              </Trans>
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <InputField
                inputMode="decimal"
                placeholder={t('Amount')}
                value={amountText}
                onChangeValue={text => setManualAmount(text, isIncome)}
                style={{ flex: 1 }}
              />
              <Button
                variant={isIncome ? 'normal' : 'primary'}
                onPress={() => setManualAmount(amountText, false)}
              >
                <Trans>Expense</Trans>
              </Button>
              <Button
                variant={isIncome ? 'primary' : 'normal'}
                onPress={() => setManualAmount(amountText, true)}
              >
                <Trans>Income</Trans>
              </Button>
            </View>
          </View>
        )}
      </View>
      {displayAmount !== null && (
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <FinancialText
            style={{
              fontWeight: 600,
              color: displayAmount < 0 ? theme.pageText : theme.noticeTextLight,
            }}
          >
            {format(
              amountToInteger(displayAmount, format.currency.decimalPlaces),
              'financial',
            )}
          </FinancialText>
          {showSignToggle && !row.isAmountManual && (
            <Button
              variant="bare"
              aria-label={t('Flip sign')}
              onPress={() => onChange({ isSignFlipped: !row.isSignFlipped })}
              style={{ padding: '2px 8px', ...styles.smallText }}
            >
              ±
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
