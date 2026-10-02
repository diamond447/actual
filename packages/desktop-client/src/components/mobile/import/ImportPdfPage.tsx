import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { amountToInteger } from '@actual-app/core/shared/util';

import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { InputField } from '#components/mobile/MobileForms';
import { MobilePageHeader, Page } from '#components/Page';
import { useAccount } from '#hooks/useAccount';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { usePayees } from '#hooks/usePayees';
import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { suggestCategories } from '#pdf-import/categorize';
import { parseStatement } from '#pdf-import/parseStatement';
import {
  readStatementPdf,
  StatementPdfError,
} from '#pdf-import/readStatementPdf';
import {
  checkStatementTotal,
  statementStats,
} from '#pdf-import/statementStats';
import type { StatementStats } from '#pdf-import/statementStats';
import { createTesseractOcr } from '#pdf-import/tesseractOcr';
import {
  effectiveAmount,
  toImportEntries,
  toStatementRows,
} from '#pdf-import/toImportTransactions';
import type {
  ImportEntry,
  StatementRow,
} from '#pdf-import/toImportTransactions';
import type { UnrecognizedLine } from '#pdf-import/types';
import { aqlQuery } from '#queries/aqlQuery';
import { useDispatch } from '#redux';

import { StatementCheckPanel } from './StatementCheckPanel';
import { StatementRowItem } from './StatementRowItem';
import type { ExistingMatch } from './StatementRowItem';
import { StatementStatsView } from './StatementStatsView';

type ReviewStep = {
  name: 'review';
  /** Changes with every statement read, to restart the suggestions */
  readId: number;
  rows: StatementRow[];
  hasUncertainSigns: boolean;
  unrecognizedLines: UnrecognizedLine[];
  openingBalance: number | null;
  closingBalance: number | null;
  isCategorizing: boolean;
  /** Rows that match a transaction already in the account, by row id */
  matches: Map<string, ExistingMatch>;
};

type Step =
  | { name: 'choose'; error?: string }
  | { name: 'password'; file: ArrayBuffer; isWrong: boolean }
  | { name: 'reading'; page: number; pageCount: number }
  | ReviewStep
  | {
      name: 'done';
      stats: StatementStats;
      addedCount: number;
      existingCount: number;
    };

export function ImportPdfPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const format = useFormat();
  const { id: accountId = '' } = useParams<{ id: string }>();
  const account = useAccount(accountId);
  const categoriesQuery = useCategories();
  const payeesQuery = usePayees();
  const categories = categoriesQuery.data?.list ?? [];
  const categoryGroups = categoriesQuery.data?.grouped ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>({ name: 'choose' });
  const [password, setPassword] = useState('');
  const [flipSigns, setFlipSigns] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const decimalPlaces = format.currency.decimalPlaces;
  const categoryNames = new Map(
    categories.map(category => [category.id, category.name]),
  );

  const updateReview = (update: (step: ReviewStep) => ReviewStep) => {
    setStep(current => (current.name === 'review' ? update(current) : current));
  };

  const readFile = async (file: ArrayBuffer, filePassword?: string) => {
    setStep({ name: 'reading', page: 0, pageCount: 0 });
    try {
      // pdf.js may detach the buffer it is given, so keep the original for a
      // retry with a password
      const pages = await readStatementPdf(file.slice(0), {
        password: filePassword,
        createOcr: createTesseractOcr,
        onProgress: progress => setStep({ name: 'reading', ...progress }),
      });
      const statement = parseStatement(pages);
      if (
        statement.transactions.length === 0 &&
        statement.unrecognizedLines.length === 0
      ) {
        setStep({
          name: 'choose',
          error: t(
            'No transactions were found in this file. Make sure it is a bank statement.',
          ),
        });
        return;
      }
      setFlipSigns(false);
      setStep({
        name: 'review',
        readId: Date.now(),
        rows: toStatementRows(statement.transactions),
        hasUncertainSigns: statement.hasUncertainSigns,
        unrecognizedLines: statement.unrecognizedLines,
        openingBalance: statement.openingBalance,
        closingBalance: statement.closingBalance,
        isCategorizing: true,
        matches: new Map(),
      });
    } catch (error) {
      if (
        error instanceof StatementPdfError &&
        error.reason !== 'invalid-pdf'
      ) {
        setStep({
          name: 'password',
          file,
          isWrong: error.reason === 'wrong-password',
        });
        return;
      }
      console.error('Failed to read PDF statement:', error);
      setStep({
        name: 'choose',
        error: t('This file could not be read. Is it a PDF?'),
      });
    }
  };

  // Suggest categories once the statement is read and the budget's
  // categories and payees are loaded
  const isDataReady = categoriesQuery.isSuccess && payeesQuery.isSuccess;
  const readId = step.name === 'review' ? step.readId : null;
  const runSuggestions = useEffectEvent(async () => {
    if (step.name !== 'review') {
      return;
    }
    const suggested = await suggestCategories(step.rows, {
      accountId,
      categories,
      payees: payeesQuery.data ?? [],
      decimalPlaces,
      runRules: transaction => send('rules-run', { transaction }),
    });
    const suggestions = new Map(suggested.map(row => [row.id, row]));
    updateReview(review =>
      review.readId !== step.readId
        ? review
        : {
            ...review,
            isCategorizing: false,
            // Keep categories the user picked while suggestions were loading
            rows: review.rows.map(row => {
              const suggestion = suggestions.get(row.id);
              return row.categorySource === 'user' || !suggestion
                ? row
                : {
                    ...row,
                    category: suggestion.category,
                    categorySource: suggestion.categorySource,
                  };
            }),
          },
    );
  });
  useEffect(() => {
    if (readId !== null && isDataReady) {
      void runSuggestions();
    }
  }, [readId, isDataReady]);

  const entries: ImportEntry[] =
    step.name === 'review'
      ? toImportEntries(step.rows, accountId, { flipSigns, decimalPlaces })
      : [];

  // Show which rows match transactions already in the account; the import
  // would merge them instead of adding them
  const previewKey = JSON.stringify(
    entries.map(({ transaction }) => [
      transaction.imported_id,
      transaction.amount,
      transaction.date,
    ]),
  );
  const runPreview = useEffectEvent(async () => {
    if (step.name !== 'review') {
      return;
    }
    const currentReadId = step.readId;
    const candidates = entries.filter(
      entry => !entry.transaction.forceAddTransaction,
    );
    const result = await send('transactions-import', {
      accountId,
      transactions: candidates.map(entry => entry.transaction),
      isPreview: true,
    });
    const rowIds = new Map(
      candidates.map(entry => [entry.transaction.imported_id, entry.rowId]),
    );
    const matches = new Map<string, ExistingMatch>();
    for (const preview of result.updatedPreview ?? []) {
      const rowId = rowIds.get(preview.transaction?.imported_id);
      if (!rowId) {
        continue;
      }
      const existing = preview.existing || null;
      matches.set(rowId, {
        payee:
          existing &&
          'payee_name' in existing &&
          typeof existing.payee_name === 'string'
            ? existing.payee_name
            : null,
        date: existing ? existing.date : null,
        amount:
          existing && typeof existing.amount === 'number'
            ? amountToInteger(existing.amount, decimalPlaces)
            : null,
      });
    }
    updateReview(review =>
      review.readId === currentReadId ? { ...review, matches } : review,
    );
  });
  useEffect(() => {
    if (readId !== null) {
      void runPreview();
    }
  }, [readId, previewKey]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      setPassword('');
      await readFile(await file.arrayBuffer());
    }
  };

  const updateRow = (id: string, changes: Partial<StatementRow>) => {
    updateReview(review => ({
      ...review,
      rows: review.rows.map(row =>
        row.id === id ? { ...row, ...changes } : row,
      ),
    }));
  };

  const pickCategory = (row: StatementRow) => {
    dispatch(
      pushModal({
        modal: {
          name: 'category-autocomplete',
          options: {
            categoryGroups,
            showNoneOption: true,
            month: monthUtils.monthFromDate(row.date),
            onSelect: categoryId => {
              updateRow(row.id, {
                category: categoryId,
                categorySource: 'user',
              });
            },
          },
        },
      }),
    );
  };

  // The total of every row with an amount, selected or not, is what the
  // statement's balances must add up to
  const toInteger = (amount: number | null) =>
    amount === null ? null : amountToInteger(amount, decimalPlaces);
  const totalCheck =
    step.name === 'review'
      ? checkStatementTotal({
          openingBalance: toInteger(step.openingBalance),
          closingBalance: toInteger(step.closingBalance),
          total: step.rows.reduce(
            (sum, row) =>
              sum + (toInteger(effectiveAmount(row, flipSigns)) ?? 0),
            0,
          ),
        })
      : null;

  const onImport = async () => {
    if (isImporting || step.name !== 'review') {
      return;
    }
    setIsImporting(true);
    try {
      const transactions = entries.map(entry => entry.transaction);
      const result = await send('transactions-import', {
        accountId,
        transactions,
        isPreview: false,
      });
      if (result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }
      const userCategoryRows = new Set(
        step.rows
          .filter(row => row.categorySource === 'user')
          .map(row => row.id),
      );
      await keepChosenCategories(
        result.added,
        entries.filter(entry => userCategoryRows.has(entry.rowId)),
      );
      setStep({
        name: 'done',
        stats: statementStats(transactions),
        addedCount: result.added.length,
        existingCount: transactions.length - result.added.length,
      });
    } catch (error) {
      console.error('Failed to import PDF statement:', error);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to import transactions. Please try again.'),
          },
        }),
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Rows that match an existing transaction are merged, not added
  const newCount =
    step.name === 'review'
      ? entries.filter(
          entry =>
            entry.transaction.forceAddTransaction ||
            !step.matches.has(entry.rowId),
        ).length
      : 0;

  const missingAmountCount =
    step.name === 'review'
      ? step.rows.filter(row => row.amount === null).length
      : 0;

  return (
    <Page
      header={
        <MobilePageHeader
          title={
            step.name === 'done'
              ? t('Statement summary')
              : t('Import PDF statement')
          }
          leftContent={<MobileBackButton onPress={() => navigate(-1)} />}
        />
      }
      footer={
        (step.name === 'review' || step.name === 'done') && (
          <View style={footerStyle}>
            {step.name === 'review' ? (
              <ButtonWithLoading
                variant="primary"
                isLoading={isImporting}
                isDisabled={newCount === 0 || isImporting}
                onPress={onImport}
                style={{ height: styles.mobileMinHeight }}
              >
                {newCount === 0 ? (
                  <Trans>All transactions are already in the account</Trans>
                ) : (
                  <Trans count={newCount}>
                    Import {{ count: newCount }} transactions
                  </Trans>
                )}
              </ButtonWithLoading>
            ) : (
              <Button
                variant="primary"
                onPress={() =>
                  navigate(`/accounts/${accountId}`, { replace: true })
                }
                style={{ height: styles.mobileMinHeight }}
              >
                <Trans>Show account</Trans>
              </Button>
            )}
          </View>
        )
      }
      padding={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {step.name === 'choose' && (
        <View style={{ padding: 20, gap: 16, flexShrink: 0 }}>
          {account && (
            <Text style={{ color: theme.pageTextSubdued }}>
              <Trans>Account: {{ accountName: account.name }}</Trans>
            </Text>
          )}
          <Button
            variant="primary"
            onPress={() => fileInputRef.current?.click()}
            style={{ height: styles.mobileMinHeight }}
          >
            <Trans>Choose PDF statement</Trans>
          </Button>
          {step.error && (
            <Text style={{ color: theme.errorText }}>{step.error}</Text>
          )}
          <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
            <Trans>
              The statement is read only on this device and is not uploaded
              anywhere. Details you blacked out are skipped.
            </Trans>
          </Text>
        </View>
      )}

      {step.name === 'password' && (
        <View style={{ padding: 20, gap: 16, flexShrink: 0 }}>
          <Text>
            {step.isWrong ? (
              <Trans>The password is not correct. Try again.</Trans>
            ) : (
              <Trans>This statement is protected by a password.</Trans>
            )}
          </Text>
          <InputField
            type="password"
            placeholder={t('Password')}
            value={password}
            onChangeValue={setPassword}
          />
          <Button
            variant="primary"
            isDisabled={password === ''}
            onPress={() => readFile(step.file, password)}
            style={{ height: styles.mobileMinHeight }}
          >
            <Trans>Open statement</Trans>
          </Button>
        </View>
      )}

      {step.name === 'reading' && (
        <View
          style={{ padding: 20, alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <Text>
            {step.pageCount > 0 ? (
              <Trans>
                Reading page {{ page: step.page }} of{' '}
                {{ pageCount: step.pageCount }}…
              </Trans>
            ) : (
              <Trans>Opening statement…</Trans>
            )}
          </Text>
          <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
            <Trans>Scanned statements can take a little longer.</Trans>
          </Text>
        </View>
      )}

      {step.name === 'review' && (
        <View style={{ flexShrink: 0 }}>
          <View style={{ padding: 15, gap: 10 }}>
            <Text>
              <Trans count={step.rows.length}>
                Found {{ count: step.rows.length }} transactions. Check them and
                uncheck the ones you do not want to import.
              </Trans>
            </Text>
            <StatementCheckPanel
              totalCheck={totalCheck}
              missingAmountCount={missingAmountCount}
              unrecognizedLines={step.unrecognizedLines}
            />
            {step.hasUncertainSigns && (
              <View style={warningStyle}>
                <Text>
                  <Trans>
                    The statement does not show which payments are expenses.
                    Make sure the amounts below have the right sign: flip all of
                    them, or a single one with ±.
                  </Trans>
                </Text>
                <Button onPress={() => setFlipSigns(!flipSigns)}>
                  <Trans>Flip all signs</Trans>
                </Button>
              </View>
            )}
          </View>
          {step.rows.map(row => (
            <StatementRowItem
              key={row.id}
              row={row}
              flipSigns={flipSigns}
              showSignToggle={step.hasUncertainSigns}
              onChange={changes => updateRow(row.id, changes)}
              categoryName={
                row.category ? (categoryNames.get(row.category) ?? null) : null
              }
              isCategorizing={step.isCategorizing}
              onPickCategory={() => pickCategory(row)}
              match={step.matches.get(row.id) ?? null}
            />
          ))}
        </View>
      )}

      {step.name === 'done' && (
        <View style={{ flexShrink: 0 }}>
          <View style={{ ...okStyle, margin: '15px 15px 0' }}>
            <Text>
              <Trans count={step.addedCount}>
                Imported {{ count: step.addedCount }} transactions
              </Trans>
            </Text>
            {step.existingCount > 0 && (
              <Text style={styles.smallText}>
                <Trans count={step.existingCount}>
                  {{ count: step.existingCount }} were already in the account
                  and were not added again.
                </Trans>
              </Text>
            )}
          </View>
          <StatementStatsView
            stats={step.stats}
            categoryNames={categoryNames}
          />
        </View>
      )}
    </Page>
  );
}

/**
 * The import runs the budget's rules, which may set another category than
 * the one the user picked in the review. Put the picked ones back, only on
 * the newly added transactions so existing ones are never changed.
 */
async function keepChosenCategories(
  addedIds: string[],
  entries: ImportEntry[],
) {
  const chosen = new Map(
    entries.map(({ transaction }) => [
      transaction.imported_id,
      transaction.category,
    ]),
  );
  if (chosen.size === 0 || addedIds.length === 0) {
    return;
  }
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ id: { $oneof: addedIds } })
      .select(['id', 'imported_id', 'category']),
  );
  const updated = (
    data as Array<{ id: string; imported_id: string; category: string | null }>
  ).flatMap(transaction => {
    const category = chosen.get(transaction.imported_id);
    return category && category !== transaction.category
      ? [{ id: transaction.id, category }]
      : [];
  });
  if (updated.length > 0) {
    await send('transactions-batch-update', { updated });
  }
}

const footerStyle = {
  paddingLeft: styles.mobileEditingPadding,
  paddingRight: styles.mobileEditingPadding,
  paddingTop: 10,
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
  backgroundColor: theme.tableHeaderBackground,
  borderTopWidth: 1,
  borderColor: theme.tableBorder,
};

const okStyle = {
  gap: 4,
  padding: 12,
  borderRadius: 6,
  backgroundColor: theme.noticeBackground,
  color: theme.noticeText,
};

const warningStyle = {
  gap: 10,
  padding: 12,
  borderRadius: 6,
  backgroundColor: theme.warningBackground,
  color: theme.warningText,
};
