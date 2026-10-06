import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgBackspace,
  SvgCheckmark,
  SvgClose,
  SvgDotsHorizontalTriple,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { getNumberFormat } from '@actual-app/core/shared/util';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import { format as formatDate, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import { CategoryBadge } from '#category-appearance';
import { Link } from '#components/common/Link';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import { useUndo } from '#hooks/useUndo';
import { addNotification } from '#notifications/notificationsSlice';
import { aqlQuery } from '#queries/aqlQuery';
import { useDispatch } from '#redux';
import { setLastTransaction } from '#transactions/transactionsSlice';

import {
  formatKeypadDisplay,
  getAmountAsInteger,
  INITIAL_KEYPAD_STATE,
  keypadReducer,
} from './keypadReducer';

const LAST_ACCOUNT_KEY = 'quick-add:last-account';

function getStoredAccountId(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function storeAccountId(id: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function QuickAddPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showUndoNotification } = useUndo();
  const { currency } = useFormat();
  const dateFormat = useDateFormat() || 'yyyy-MM-dd';

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [keypadState, dispatchKeypad] = useReducer(
    keypadReducer,
    INITIAL_KEYPAD_STATE,
  );
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => monthUtils.currentDay());
  const dateInputRef = useRef<HTMLInputElement>(null);

  const { data: accountsData } = useOnBudgetAccounts();
  const onBudgetAccounts = useMemo(() => accountsData ?? [], [accountsData]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);

  // Initialize selected account from localStorage or first on-budget account
  useEffect(() => {
    if (selectedAccountId == null && onBudgetAccounts.length > 0) {
      const rememberedId = getStoredAccountId();
      if (rememberedId && onBudgetAccounts.some(a => a.id === rememberedId)) {
        setSelectedAccountId(rememberedId);
      } else {
        setSelectedAccountId(onBudgetAccounts[0].id);
      }
    }
  }, [selectedAccountId, onBudgetAccounts]);

  const selectedAccount = useMemo(
    () => onBudgetAccounts.find(a => a.id === selectedAccountId) ?? null,
    [onBudgetAccounts, selectedAccountId],
  );

  const { data: categoriesData } = useCategories();
  const [recentCounts, setRecentCounts] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);

  // Query most used categories over the last 90 days
  useEffect(() => {
    let unmounted = false;
    async function loadRecentCounts() {
      try {
        const since = monthUtils.subDays(monthUtils.currentDay(), 90);
        const result = await aqlQuery(
          q('transactions')
            .filter({
              date: { $gte: since },
              category: { $ne: null },
            })
            .select(['category']),
        );
        if (unmounted) return;
        const counts = new Map<string, number>();
        const items =
          (result as { data?: Array<{ category?: string }> })?.data ?? [];
        for (const item of items) {
          if (item?.category) {
            counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
          }
        }
        setRecentCounts(counts);
      } catch {
        // Fallback silently if transactions query fails
      }
    }
    void loadRecentCounts();
    return () => {
      unmounted = true;
    };
  }, []);

  const isIncome = type === 'income';

  const availableCategories = useMemo(() => {
    const list = categoriesData?.list ?? [];
    return list.filter(
      c => !c.hidden && (isIncome ? !!c.is_income : !c.is_income),
    );
  }, [categoriesData?.list, isIncome]);

  const displayedCategories = useMemo(() => {
    const sorted = [...availableCategories].sort((a, b) => {
      const countA = recentCounts.get(a.id) ?? 0;
      const countB = recentCounts.get(b.id) ?? 0;
      if (countB !== countA) {
        return countB - countA;
      }
      return 0;
    });

    const top7 = sorted.slice(0, 7);
    if (selectedCategoryId && !top7.some(c => c.id === selectedCategoryId)) {
      const selectedCat = availableCategories.find(
        c => c.id === selectedCategoryId,
      );
      if (selectedCat) {
        return [...top7.slice(0, 6), selectedCat];
      }
    }
    return top7;
  }, [availableCategories, recentCounts, selectedCategoryId]);

  const groupedCategories = useMemo(() => {
    const groups = categoriesData?.grouped ?? [];
    return groups.filter(
      g => !g.hidden && (isIncome ? !!g.is_income : !g.is_income),
    );
  }, [categoriesData?.grouped, isIncome]);

  const { decimalSeparator, thousandsSeparator } = getNumberFormat();
  const amountFormatted = formatKeypadDisplay(
    keypadState,
    decimalSeparator,
    thousandsSeparator,
  );
  const amountInCents = getAmountAsInteger(keypadState, 2);

  const [isSaving, setIsSaving] = useState(false);
  const isSaveDisabled =
    isSaving || amountInCents <= 0 || !selectedCategoryId || !selectedAccountId;

  const handleSave = async () => {
    if (isSaveDisabled || !selectedAccount) return;
    setIsSaving(true);
    try {
      const finalAmount = type === 'expense' ? -amountInCents : amountInCents;
      const transaction: TransactionEntity = {
        id: uuidv4(),
        account: selectedAccount.id,
        date,
        amount: finalAmount,
        category: selectedCategoryId,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      await send('transactions-batch-update', {
        added: [transaction],
      });

      dispatch(setLastTransaction({ transaction }));
      storeAccountId(selectedAccount.id);

      showUndoNotification({
        message: t('Transaction added'),
      });

      void navigate(-1);
    } catch {
      setIsSaving(false);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('The transaction could not be saved. Please try again.'),
          },
        }),
      );
    }
  };

  const displayDate = useMemo(() => {
    if (date === monthUtils.currentDay()) {
      return t('Today');
    }
    try {
      return formatDate(parseISO(date), dateFormat);
    } catch {
      return date;
    }
  }, [date, dateFormat, t]);

  const currencySymbol = currency.symbol || currency.code;
  const sign = type === 'expense' ? '\u2212' : '+';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        maxHeight: '100%',
        width: '100%',
        boxSizing: 'border-box',
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        backgroundColor: theme.mobilePageBackground,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 1. Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label={t('Close')}
          onClick={() => navigate(-1)}
          style={{
            ...styles.noTapHighlight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            border: 'none',
            background: 'transparent',
            color: theme.pageText,
            cursor: 'pointer',
            padding: 0,
            borderRadius: 12,
          }}
        >
          <SvgClose width={18} height={18} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 3,
            borderRadius: 18,
            backgroundColor: theme.tableBackground,
            border: `1px solid ${theme.tableBorder}`,
            gap: 2,
          }}
        >
          <button
            type="button"
            aria-pressed={type === 'expense'}
            onClick={() => {
              setType('expense');
              setSelectedCategoryId(null);
            }}
            style={{
              ...styles.noTapHighlight,
              border: 'none',
              borderRadius: 15,
              padding: '5px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor:
                type === 'expense'
                  ? theme.buttonPrimaryBackground
                  : 'transparent',
              color:
                type === 'expense'
                  ? theme.buttonPrimaryText
                  : theme.pageTextSubdued,
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <Trans>Expense</Trans>
          </button>
          <button
            type="button"
            aria-pressed={type === 'income'}
            onClick={() => {
              setType('income');
              setSelectedCategoryId(null);
            }}
            style={{
              ...styles.noTapHighlight,
              border: 'none',
              borderRadius: 15,
              padding: '5px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor:
                type === 'income'
                  ? theme.buttonPrimaryBackground
                  : 'transparent',
              color:
                type === 'income'
                  ? theme.buttonPrimaryText
                  : theme.pageTextSubdued,
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <Trans>Income</Trans>
          </button>
        </div>

        <Link
          variant="internal"
          to="/transactions/new"
          style={{
            textDecoration: 'none',
            color: theme.pageTextSubdued,
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 4px',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
          }}
        >
          <Trans>More details</Trans>
        </Link>
      </div>

      {/* 2. Big amount display + subdued account & date line */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            fontSize: 52,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color:
              type === 'expense' ? theme.numberNegative : theme.numberPositive,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ marginRight: 4 }}>{sign}</span>
          <span>{amountFormatted}</span>
          {currencySymbol && (
            <span
              style={{
                marginLeft: 6,
                fontSize: '0.5em',
                fontWeight: 600,
                color: theme.pageTextSubdued,
              }}
            >
              {currencySymbol}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 13,
            color: theme.pageTextSubdued,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setIsAccountSheetOpen(true)}
            style={{
              ...styles.noTapHighlight,
              border: 'none',
              background: 'transparent',
              padding: '4px 6px',
              color: theme.pageTextSubdued,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Trans>
              Account:{' '}
              <span
                style={{
                  fontWeight: 600,
                  color: theme.pageText,
                  marginLeft: 4,
                }}
              >
                {selectedAccount?.name || t('Select account')}
              </span>
            </Trans>
          </button>
          <span aria-hidden="true">·</span>
          <label
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              style={{
                ...styles.noTapHighlight,
                border: 'none',
                background: 'transparent',
                padding: '4px 6px',
                color: theme.pageTextSubdued,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: 8,
              }}
            >
              {displayDate}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={e => {
                if (e.target.value) {
                  setDate(e.target.value);
                }
              }}
              aria-label={t('Date')}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
              }}
            />
          </label>
        </div>
      </div>

      {/* 3. Category grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '8px 4px',
          flexShrink: 0,
        }}
      >
        {displayedCategories.map(cat => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedCategoryId(cat.id)}
              style={{
                ...styles.noTapHighlight,
                border: 'none',
                background: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 0',
                cursor: 'pointer',
                minWidth: 0,
              }}
            >
              <CategoryBadge
                category={cat}
                size={40}
                style={
                  isSelected
                    ? {
                        boxShadow: `0 0 0 2px ${theme.mobilePageBackground}, 0 0 0 4px ${theme.buttonPrimaryBackground}`,
                      }
                    : undefined
                }
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isSelected ? theme.pageText : theme.pageTextSubdued,
                  marginTop: 4,
                  width: '100%',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setIsCategorySheetOpen(true)}
          style={{
            ...styles.noTapHighlight,
            border: 'none',
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 0',
            cursor: 'pointer',
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              borderRadius: 13,
              backgroundColor: theme.tableBackground,
              border: `1px solid ${theme.tableBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.pageTextSubdued,
              boxSizing: 'border-box',
            }}
          >
            <SvgDotsHorizontalTriple width={18} height={18} />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.pageTextSubdued,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            <Trans>More</Trans>
          </span>
        </button>
      </div>

      {/* 4. Note field */}
      <div style={{ flexShrink: 0 }}>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('Note (optional)')}
          aria-label={t('Note (optional)')}
          style={{
            width: '100%',
            height: 38,
            boxSizing: 'border-box',
            padding: '0 12px',
            borderRadius: 12,
            border: `1px solid ${theme.tableBorder}`,
            backgroundColor: theme.tableBackground,
            color: theme.pageText,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      {/* 5. Numeric keypad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => dispatchKeypad({ type: 'digit', digit: d })}
            style={keypadButtonStyle}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dispatchKeypad({ type: 'decimal' })}
          style={keypadButtonStyle}
        >
          {decimalSeparator}
        </button>
        <button
          type="button"
          onClick={() => dispatchKeypad({ type: 'digit', digit: '0' })}
          style={keypadButtonStyle}
        >
          0
        </button>
        <button
          type="button"
          aria-label={t('Delete')}
          onClick={() => dispatchKeypad({ type: 'backspace' })}
          style={keypadButtonStyle}
        >
          <SvgBackspace width={22} height={22} />
        </button>
      </div>

      {/* 6. Save button */}
      <div style={{ flexShrink: 0 }}>
        <Button
          variant="primary"
          isDisabled={isSaveDisabled}
          onPress={handleSave}
          style={{
            width: '100%',
            height: 54,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 700,
            backgroundColor: theme.buttonPrimaryBackground,
            color: theme.buttonPrimaryText,
            opacity: isSaveDisabled ? 0.4 : 1,
            cursor: isSaveDisabled ? 'default' : 'pointer',
          }}
        >
          <Trans>Save</Trans>
        </Button>
      </div>

      {/* Account bottom sheet */}
      <ModalOverlay
        isOpen={isAccountSheetOpen}
        onOpenChange={setIsAccountSheetOpen}
        isDismissable
        className={overlayClass}
      >
        <Modal className={sheetClass}>
          <Dialog
            aria-label={t('Select account')}
            style={{
              outline: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {({ close }) => (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 4,
                  }}
                >
                  <Heading
                    level={2}
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: theme.pageText,
                    }}
                  >
                    <Trans>Select account</Trans>
                  </Heading>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: theme.mobileNavItemSelected,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trans>Done</Trans>
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: '60vh',
                    overflowY: 'auto',
                  }}
                >
                  {onBudgetAccounts.map(account => {
                    const isSelected = account.id === selectedAccount?.id;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          setSelectedAccountId(account.id);
                          storeAccountId(account.id);
                          close();
                        }}
                        style={{
                          ...styles.noTapHighlight,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 14,
                          backgroundColor: theme.tableBackground,
                          border: isSelected
                            ? `2px solid ${theme.buttonPrimaryBackground}`
                            : `1px solid ${theme.tableBorder}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: isSelected ? 700 : 500,
                            color: theme.pageText,
                          }}
                        >
                          {account.name}
                        </span>
                        {isSelected && (
                          <SvgCheckmark
                            width={18}
                            height={18}
                            style={{ color: theme.buttonPrimaryBackground }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Category "More" bottom sheet */}
      <ModalOverlay
        isOpen={isCategorySheetOpen}
        onOpenChange={setIsCategorySheetOpen}
        isDismissable
        className={overlayClass}
      >
        <Modal className={sheetClass}>
          <Dialog
            aria-label={t('Select category')}
            style={{
              outline: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {({ close }) => (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 4,
                  }}
                >
                  <Heading
                    level={2}
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: theme.pageText,
                    }}
                  >
                    <Trans>Select category</Trans>
                  </Heading>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: theme.mobileNavItemSelected,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trans>Done</Trans>
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    maxHeight: '65vh',
                    overflowY: 'auto',
                  }}
                >
                  {groupedCategories.map(group => {
                    const groupCategories = (group.categories ?? []).filter(
                      cat => !cat.hidden,
                    );
                    if (groupCategories.length === 0) return null;
                    return (
                      <div key={group.id}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: theme.pageTextSubdued,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: 8,
                            paddingLeft: 4,
                          }}
                        >
                          {group.name}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: 8,
                          }}
                        >
                          {groupCategories.map(cat => {
                            const isSelected = cat.id === selectedCategoryId;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryId(cat.id);
                                  close();
                                }}
                                style={{
                                  ...styles.noTapHighlight,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '10px 12px',
                                  borderRadius: 14,
                                  backgroundColor: theme.tableBackground,
                                  border: isSelected
                                    ? `2px solid ${theme.buttonPrimaryBackground}`
                                    : `1px solid ${theme.tableBorder}`,
                                  cursor: 'pointer',
                                  minWidth: 0,
                                  textAlign: 'left',
                                }}
                              >
                                <CategoryBadge category={cat} size={32} />
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? 700 : 500,
                                    color: theme.pageText,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {cat.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}

const keypadButtonStyle: CSSProperties = {
  ...styles.noTapHighlight,
  height: 52,
  borderRadius: 12,
  backgroundColor: theme.tableBackground,
  color: theme.pageText,
  fontSize: 22,
  fontWeight: 600,
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
};

const overlayClass = css({
  position: 'fixed',
  inset: 0,
  zIndex: 3000,
  backgroundColor: theme.overlayBackground,
  display: 'flex',
  alignItems: 'flex-end',
});

const sheetClass = css({
  width: '100%',
  boxSizing: 'border-box',
  padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
  borderRadius: '24px 24px 0 0',
  backgroundColor: theme.mobilePageBackground,
  outline: 'none',
});
