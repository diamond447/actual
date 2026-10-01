import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { amountToInteger, currencyToAmount } from '@actual-app/core/shared/util';

import { FinancialText } from '#components/FinancialText';
import { Checkbox } from '#components/forms';
import { InputField } from '#components/mobile/MobileForms';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import type { StatementRow } from '#pdf-import/toImportTransactions';

type StatementRowItemProps = {
  row: StatementRow;
  flipSigns: boolean;
  onChange: (changes: Partial<StatementRow>) => void;
};

export function StatementRowItem({
  row,
  flipSigns,
  onChange,
}: StatementRowItemProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [amountText, setAmountText] = useState('');

  const needsAmount = row.reviewReasons.includes('missing-amount');
  const isRedacted = row.reviewReasons.includes('redacted');
  const displayAmount =
    row.amount === null ? null : flipSigns ? -row.amount : row.amount;
  const checkboxId = `statement-row-${row.id}`;

  const onAmountChange = (text: string) => {
    setAmountText(text);
    const amount = currencyToAmount(text);
    // Amounts the user types in are expenses unless they start with "+"
    const value =
      amount === null
        ? null
        : text.trim().startsWith('+')
          ? Math.abs(amount)
          : -Math.abs(amount);
    onChange({
      amount: value === null || !flipSigns ? value : -value,
      isSelected: value !== null,
    });
  };

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
            {row.payee || t('(no description)')}
          </Text>
        </label>
        <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
          {monthUtils.format(row.date, dateFormat)}
          {row.notes && row.notes !== row.payee ? ` · ${row.notes}` : ''}
        </Text>
        {isRedacted && (
          <Text style={{ color: theme.warningText, ...styles.smallText }}>
            <Trans>Some details are blacked out.</Trans>
          </Text>
        )}
        {needsAmount && (
          <View style={{ marginTop: 6, gap: 4 }}>
            <Text style={{ color: theme.warningText, ...styles.smallText }}>
              <Trans>
                The amount could not be read. Type it in to import this
                transaction.
              </Trans>
            </Text>
            <InputField
              inputMode="decimal"
              placeholder={t('Amount')}
              value={amountText}
              onChangeValue={onAmountChange}
            />
          </View>
        )}
      </View>
      {displayAmount !== null && !needsAmount && (
        <FinancialText
          style={{
            fontWeight: 600,
            color: displayAmount < 0 ? theme.errorText : theme.noticeTextLight,
          }}
        >
          {format(
            amountToInteger(displayAmount, format.currency.decimalPlaces),
            'financial',
          )}
        </FinancialText>
      )}
    </View>
  );
}
