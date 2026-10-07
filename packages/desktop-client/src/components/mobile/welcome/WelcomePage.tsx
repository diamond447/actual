import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import { q } from '@actual-app/core/shared/query';
import {
  amountToInteger,
  currencyToAmount,
  parseNumberFormat,
  setNumberFormat,
} from '@actual-app/core/shared/util';
import type { SyncedPrefs } from '@actual-app/core/types/prefs';
import { useQueryClient } from '@tanstack/react-query';

import { accountQueries } from '#accounts';
import { categoryQueries } from '#budget';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { setI18NextLanguage } from '#i18n';
import { addNotification } from '#notifications/notificationsSlice';
import { saveSyncedPrefs } from '#prefs/prefsSlice';
import { aqlQuery } from '#queries/aqlQuery';
import { useDispatch } from '#redux';

import {
  PRESET_EXPENSE_CATEGORIES,
  PRESET_SALARY_CATEGORY,
} from './categoriesPreset';
import type {
  CleanupCategoryGroup,
  CleanupTransaction,
} from './categoryCleanupHelper';
import { getCategoriesToDelete } from './categoryCleanupHelper';
import type { OnboardingCurrency, OnboardingLanguage } from './currencyHelper';
import {
  getCurrencyPrefs,
  resolveInitialCurrency,
  resolveInitialLanguage,
} from './currencyHelper';
import { StepAccount } from './StepAccount';
import { StepCategories } from './StepCategories';
import { StepCurrency } from './StepCurrency';
import { StepFinish } from './StepFinish';
import { StepLanguage } from './StepLanguage';
import { WelcomeStepIndicator } from './WelcomeStepIndicator';

const CURRENCY_SYMBOLS: Record<OnboardingCurrency, string> = {
  CZK: 'Kč',
  EUR: '€',
  USD: '$',
};

// The guide is usually reached by a redirect from /overview, and our
// useNavigate goes back in history when the target equals the previous
// page, which would leave the budget. A state of its own forces a real
// navigation.
const OVERVIEW_NAVIGATION = {
  replace: true,
  state: { fromOnboarding: true },
};

export function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [onboardingCompleted] = useSyncedPref('onboarding-completed');
  const [globalLanguage, setGlobalLanguage] = useGlobalPref('language');

  // If onboarding was already completed for this budget, go straight to /overview
  useEffect(() => {
    if (onboardingCompleted === 'true') {
      void navigate('/overview', OVERVIEW_NAVIGATION);
    }
  }, [onboardingCompleted, navigate]);

  // Current onboarding step: 1 (Language), 2 (Currency), 3 (Account), 4 (Categories), 5 (Finish)
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: Language
  const [selectedLanguage, setSelectedLanguage] = useState<OnboardingLanguage>(
    () => {
      const browserLang =
        typeof navigator !== 'undefined' ? navigator.language : undefined;
      return resolveInitialLanguage(globalLanguage, browserLang);
    },
  );

  // Step 2: Currency
  const [userHasChosenCurrency, setUserHasChosenCurrency] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<OnboardingCurrency>(
    () => resolveInitialCurrency(selectedLanguage),
  );

  // Step 3: Account
  const [accountName, setAccountName] = useState(() => t('Checking account'));
  const [balanceStr, setBalanceStr] = useState('');
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  // Step 4: Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () =>
      new Set(
        PRESET_EXPENSE_CATEGORIES.filter(c => c.defaultSelected).map(c => c.id),
      ),
  );

  const handleSelectLanguage = (lang: OnboardingLanguage) => {
    setSelectedLanguage(lang);
    setGlobalLanguage(lang);
    setI18NextLanguage(lang);
    if (!userHasChosenCurrency) {
      setSelectedCurrency(resolveInitialCurrency(lang));
    }
  };

  const handleSelectCurrency = (curr: OnboardingCurrency) => {
    setSelectedCurrency(curr);
    setUserHasChosenCurrency(true);
  };

  const handleToggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBack = () => {
    if (currentStep > 1 && currentStep <= 4) {
      setCurrentStep(step => step - 1);
    }
  };

  const handleSkip = async () => {
    try {
      await dispatch(
        saveSyncedPrefs({
          prefs: { 'onboarding-completed': 'true' },
        }),
      );
      void navigate('/overview', OVERVIEW_NAVIGATION);
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      void navigate('/overview', OVERVIEW_NAVIGATION);
    }
  };

  const handleContinueLanguage = () => {
    if (!userHasChosenCurrency) {
      setSelectedCurrency(resolveInitialCurrency(selectedLanguage));
    }
    setCurrentStep(2);
  };

  const handleContinueCurrency = async () => {
    setIsSaving(true);
    try {
      const currencyPrefs = getCurrencyPrefs(
        selectedCurrency,
        selectedLanguage,
      );
      await dispatch(saveSyncedPrefs({ prefs: currencyPrefs }));

      if (currencyPrefs.numberFormat) {
        setNumberFormat(
          parseNumberFormat({ format: currencyPrefs.numberFormat }),
        );
      }

      setCurrentStep(3);
    } catch (error) {
      console.error('Failed to save currency preferences:', error);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Failed to save currency preferences. Please try again.',
            ),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinueAccount = async () => {
    setIsSaving(true);
    try {
      const finalName = accountName.trim() || t('Checking account');
      // Parsed with the number format chosen in the previous step, so
      // "25,000" is 25 thousand in English and 25 in Czech
      const balanceText = balanceStr.trim();
      const balanceAmount =
        balanceText === '' ? 0 : currencyToAmount(balanceText);
      if (balanceAmount === null) {
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              message: t('Enter the balance as a number, for example 12 500.'),
            },
          }),
        );
        return;
      }

      if (createdAccountId) {
        await send('account-update', {
          id: createdAccountId,
          name: finalName,
        });
        // Coming back to this step may change the balance too: keep the
        // starting balance transaction in line with what is shown
        const { data: startingBalances } = await aqlQuery(
          q('transactions')
            .filter({ account: createdAccountId, starting_balance_flag: true })
            .select('*'),
        );
        const startingBalance = (startingBalances ?? [])[0];
        const balanceInteger = amountToInteger(balanceAmount);
        if (startingBalance && startingBalance.amount !== balanceInteger) {
          await send('transactions-batch-update', {
            updated: [{ ...startingBalance, amount: balanceInteger }],
          });
        } else if (!startingBalance && balanceInteger !== 0) {
          // The account was created with no balance; never drop the new one
          // silently
          dispatch(
            addNotification({
              notification: {
                type: 'error',
                message: t(
                  'The account already exists without a starting balance. Add the balance as a transaction after the setup.',
                ),
              },
            }),
          );
        }
      } else {
        const id = (await send('account-create', {
          name: finalName,
          balance: balanceAmount,
          offBudget: false,
        })) as string;
        setCreatedAccountId(id);
      }

      void queryClient.invalidateQueries({
        queryKey: accountQueries.lists(),
      });
      setCurrentStep(4);
    } catch (error) {
      console.error('Failed to create account:', error);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to create account. Please try again.'),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinueCategories = async () => {
    setIsSaving(true);
    try {
      // 1. Fetch current transactions to check if any user transactions exist
      const { data: transData } = await aqlQuery(q('transactions').select('*'));
      const transactions = (transData ?? []) as CleanupTransaction[];

      // 2. Fetch existing categories and groups
      const { grouped: existingGroups = [] } = (await send(
        'get-categories',
      )) as {
        grouped: CleanupCategoryGroup[];
      };

      // 3. Determine and delete upstream default categories
      const deletions = getCategoriesToDelete({
        groups: existingGroups,
        transactions,
      });

      for (const catId of deletions.categoryIds) {
        await send('category-delete', { id: catId });
      }
      for (const groupId of deletions.groupIds) {
        await send('category-group-delete', { id: groupId });
      }

      // 4. Create expense group named t('Expenses')
      const expensesGroupId = (await send('category-group-create', {
        name: t('Expenses'),
      })) as string;

      // 5. Create selected categories under expense group and collect appearance prefs
      const appearancePrefs: SyncedPrefs = {};

      const selectedCategories = PRESET_EXPENSE_CATEGORIES.filter(cat =>
        selectedCategoryIds.has(cat.id),
      );

      // A new category goes to the top of its group, so create them last to
      // first to keep the order of the list
      for (const cat of [...selectedCategories].reverse()) {
        const catId = (await send('category-create', {
          name: t(cat.name),
          groupId: expensesGroupId,
          isIncome: false,
          hidden: false,
        })) as string;

        appearancePrefs[`category-appearance-${catId}`] = JSON.stringify({
          icon: cat.icon,
          color: cat.color,
        });
      }

      // 6. New budgets already have an income group; add Salary there and
      // create t('Income') only when there is none
      const existingIncomeGroup = existingGroups.find(
        group => !!group.is_income,
      );
      const incomeGroupId =
        existingIncomeGroup?.id ??
        ((await send('category-group-create', {
          name: t('Income'),
          isIncome: true,
        })) as string);

      // 7. Create Salary category in income group
      const salaryId = (await send('category-create', {
        name: t(PRESET_SALARY_CATEGORY.name),
        groupId: incomeGroupId,
        isIncome: true,
        hidden: false,
      })) as string;

      appearancePrefs[`category-appearance-${salaryId}`] = JSON.stringify({
        icon: PRESET_SALARY_CATEGORY.icon,
        color: PRESET_SALARY_CATEGORY.color,
      });

      // 8. Save appearance synced preferences
      if (Object.keys(appearancePrefs).length > 0) {
        await dispatch(saveSyncedPrefs({ prefs: appearancePrefs }));
      }

      // 9. Invalidate category queries
      void queryClient.invalidateQueries({
        queryKey: categoryQueries.lists(),
      });

      setCurrentStep(5);
    } catch (error) {
      console.error('Failed to create categories:', error);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to save categories. Please try again.'),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await dispatch(
        saveSyncedPrefs({
          prefs: { 'onboarding-completed': 'true' },
        }),
      );
      void navigate('/overview', OVERVIEW_NAVIGATION);
    } catch (error) {
      console.error('Failed to finish onboarding:', error);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to complete onboarding. Please try again.'),
          },
        }),
      );
      setIsSaving(false);
    }
  };

  const handlePrimaryAction = () => {
    switch (currentStep) {
      case 1:
        handleContinueLanguage();
        break;
      case 2:
        void handleContinueCurrency();
        break;
      case 3:
        void handleContinueAccount();
        break;
      case 4:
        void handleContinueCategories();
        break;
      case 5:
        void handleFinish();
        break;
      default:
        break;
    }
  };

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
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        backgroundColor: theme.mobilePageBackground,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <WelcomeStepIndicator
        currentStep={currentStep}
        onBack={handleBack}
        onSkip={() => void handleSkip()}
        isSaving={isSaving}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: theme.tableBackground,
          borderRadius: 22,
          padding: '20px 18px',
          border: `1px solid ${theme.tableBorder}`,
          display: 'flex',
          flexDirection: 'column',
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        {currentStep === 1 && (
          <StepLanguage
            selectedLanguage={selectedLanguage}
            onSelectLanguage={handleSelectLanguage}
          />
        )}
        {currentStep === 2 && (
          <StepCurrency
            selectedCurrency={selectedCurrency}
            onSelectCurrency={handleSelectCurrency}
          />
        )}
        {currentStep === 3 && (
          <StepAccount
            accountName={accountName}
            onAccountNameChange={setAccountName}
            balanceStr={balanceStr}
            onBalanceChange={setBalanceStr}
            currencySymbol={CURRENCY_SYMBOLS[selectedCurrency]}
          />
        )}
        {currentStep === 4 && (
          <StepCategories
            selectedCategoryIds={selectedCategoryIds}
            onToggleCategory={handleToggleCategory}
          />
        )}
        {currentStep === 5 && <StepFinish />}
      </div>

      <div style={{ flexShrink: 0 }}>
        <Button
          variant="primary"
          isDisabled={isSaving}
          onPress={handlePrimaryAction}
          style={{
            width: '100%',
            height: 54,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 700,
            backgroundColor: theme.buttonPrimaryBackground,
            color: theme.buttonPrimaryText,
            opacity: isSaving ? 0.6 : 1,
            cursor: isSaving ? 'default' : 'pointer',
          }}
        >
          {currentStep === 5 ? (
            isSaving ? (
              <Trans>Starting...</Trans>
            ) : (
              <Trans>Start</Trans>
            )
          ) : isSaving ? (
            <Trans>Saving...</Trans>
          ) : (
            <Trans>Continue</Trans>
          )}
        </Button>
      </div>
    </div>
  );
}
