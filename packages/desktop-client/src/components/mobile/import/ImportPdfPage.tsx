import React, { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { InputField } from '#components/mobile/MobileForms';
import { MobilePageHeader, Page } from '#components/Page';
import { useAccount } from '#hooks/useAccount';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { addNotification } from '#notifications/notificationsSlice';
import { parseStatement } from '#pdf-import/parseStatement';
import {
  readStatementPdf,
  StatementPdfError,
} from '#pdf-import/readStatementPdf';
import { createTesseractOcr } from '#pdf-import/tesseractOcr';
import {
  toImportTransactions,
  toStatementRows,
} from '#pdf-import/toImportTransactions';
import type { StatementRow } from '#pdf-import/toImportTransactions';
import { useDispatch } from '#redux';

import { StatementRowItem } from './StatementRowItem';

type Step =
  | { name: 'choose'; error?: string }
  | { name: 'password'; file: ArrayBuffer; isWrong: boolean }
  | { name: 'reading'; page: number; pageCount: number }
  | { name: 'review'; rows: StatementRow[]; hasUncertainSigns: boolean };

export function ImportPdfPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const format = useFormat();
  const { id: accountId = '' } = useParams<{ id: string }>();
  const account = useAccount(accountId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>({ name: 'choose' });
  const [password, setPassword] = useState('');
  const [flipSigns, setFlipSigns] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
      if (statement.transactions.length === 0) {
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
        rows: toStatementRows(statement.transactions),
        hasUncertainSigns: statement.hasUncertainSigns,
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

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      setPassword('');
      await readFile(await file.arrayBuffer());
    }
  };

  const updateRow = (id: string, changes: Partial<StatementRow>) => {
    if (step.name !== 'review') {
      return;
    }
    setStep({
      ...step,
      rows: step.rows.map(row =>
        row.id === id ? { ...row, ...changes } : row,
      ),
    });
  };

  const transactions =
    step.name === 'review'
      ? toImportTransactions(step.rows, accountId, {
          flipSigns,
          decimalPlaces: format.currency.decimalPlaces,
        })
      : [];

  const onImport = async () => {
    if (isImporting) {
      return;
    }
    setIsImporting(true);
    try {
      const result = await send('transactions-import', {
        accountId,
        transactions,
        isPreview: false,
      });
      if (result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }
      dispatch(
        addNotification({
          notification: {
            type: 'message',
            message: t('Imported {{count}} transactions', {
              count: result.added.length,
            }),
          },
        }),
      );
      void navigate(`/accounts/${accountId}`, { replace: true });
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

  return (
    <Page
      header={
        <MobilePageHeader
          title={t('Import PDF statement')}
          leftContent={<MobileBackButton onPress={() => navigate(-1)} />}
        />
      }
      footer={
        step.name === 'review' && (
          <View style={footerStyle}>
            <ButtonWithLoading
              variant="primary"
              isLoading={isImporting}
              isDisabled={transactions.length === 0 || isImporting}
              onPress={onImport}
              style={{ height: styles.mobileMinHeight }}
            >
              <Trans count={transactions.length}>
                Import {{ count: transactions.length }} transactions
              </Trans>
            </ButtonWithLoading>
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
        <View style={{ padding: 20, gap: 16 }}>
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
        <View style={{ padding: 20, gap: 16 }}>
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
        <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
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
        <View>
          <View style={{ padding: 15, gap: 10 }}>
            <Text>
              <Trans count={step.rows.length}>
                Found {{ count: step.rows.length }} transactions. Check them and
                uncheck the ones you do not want to import.
              </Trans>
            </Text>
            {step.hasUncertainSigns && (
              <View style={warningStyle}>
                <Text>
                  <Trans>
                    The statement does not show which payments are expenses.
                    Make sure the amounts below have the right sign.
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
              onChange={changes => updateRow(row.id, changes)}
            />
          ))}
        </View>
      )}
    </Page>
  );
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

const warningStyle = {
  gap: 10,
  padding: 12,
  borderRadius: 6,
  backgroundColor: theme.warningBackground,
  color: theme.warningText,
};
