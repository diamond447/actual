import React from 'react';
import { Trans } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';
import type { UnrecognizedLine } from '#pdf-import/types';

type StatementCheckPanelProps = {
  /** Result of checkStatementTotal, integer amounts */
  totalCheck: { expected: number; difference: number } | null;
  missingAmountCount: number;
  unrecognizedLines: UnrecognizedLine[];
};

/**
 * Tells the user how far the import can be trusted: whether the total
 * matches the balances printed on the statement, and which lines could
 * not be read, so no money goes missing unnoticed.
 */
export function StatementCheckPanel({
  totalCheck,
  missingAmountCount,
  unrecognizedLines,
}: StatementCheckPanelProps) {
  const format = useFormat();
  const isTotalOk = totalCheck?.difference === 0;

  return (
    <View style={{ gap: 10 }}>
      <View style={isTotalOk ? okStyle : warningStyle}>
        {totalCheck === null ? (
          <Text>
            <Trans>
              The statement has no opening and closing balance that could be
              read, so the total cannot be checked. Compare the amounts with the
              statement.
            </Trans>
          </Text>
        ) : isTotalOk ? (
          <Text>
            <Trans>
              The total of the transactions matches the balances on the
              statement.
            </Trans>
          </Text>
        ) : (
          <Text>
            <Trans>
              The total does not match the balances on the statement. Missing
              amount:
            </Trans>{' '}
            <FinancialText style={{ fontWeight: 700 }}>
              {format(totalCheck.difference, 'financial')}
            </FinancialText>
          </Text>
        )}
        {missingAmountCount > 0 && (
          <Text style={styles.smallText}>
            <Trans count={missingAmountCount}>
              {{ count: missingAmountCount }} transactions have no amount. Type
              the amounts in below.
            </Trans>
          </Text>
        )}
      </View>

      {unrecognizedLines.length > 0 && (
        <View style={warningStyle}>
          <Text style={{ fontWeight: 600 }}>
            <Trans count={unrecognizedLines.length}>
              {{ count: unrecognizedLines.length }} lines of the statement could
              not be read as transactions. If any of them is a payment, add it
              by hand after the import.
            </Trans>
          </Text>
          {unrecognizedLines.map((line, index) => (
            <View
              key={index}
              style={{ flexDirection: 'row', gap: 8, ...styles.smallText }}
            >
              <Text style={{ flexShrink: 0, color: theme.pageTextSubdued }}>
                <Trans>Page {{ page: line.page }}</Trans>
              </Text>
              <Text style={{ wordBreak: 'break-word' }}>
                {line.reason === 'unreadable-page' ? (
                  <Trans>The whole page could not be read.</Trans>
                ) : (
                  line.text
                )}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const okStyle = {
  gap: 6,
  padding: 12,
  borderRadius: 6,
  backgroundColor: theme.noticeBackground,
  color: theme.noticeText,
};

const warningStyle = {
  gap: 6,
  padding: 12,
  borderRadius: 6,
  backgroundColor: theme.warningBackground,
  color: theme.warningText,
};
