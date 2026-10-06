import type { ComponentType, CSSProperties, ReactNode } from 'react';
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Button as RACButton,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgCog,
  SvgCreditCard,
  SvgPiggyBank,
  SvgReports,
  SvgStoreFront,
  SvgTuning,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';

import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

const TAB_BAR_HEIGHT = 64;
// Room for the iPhone home indicator when the app runs as a home-screen PWA.
const MAX_SAFE_AREA_BOTTOM = 34;

/**
 * Bottom padding a page needs so its last row clears the tab bar.
 */
export const MOBILE_NAV_HEIGHT = TAB_BAR_HEIGHT + MAX_SAFE_AREA_BOTTOM;

/**
 * Fork-only bottom tab bar: four destinations, a raised "add transaction"
 * button in the middle and a "More" sheet for everything else.
 */
export function MobileTabBar() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const { pathname } = useLocation();
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;

  if (!isNarrowWidth) return null;

  const moreSections: MoreSection[] = [
    {
      title: null,
      items: [
        { name: t('Accounts'), path: '/accounts', Icon: SvgPiggyBank },
        { name: t('Reports'), path: '/reports', Icon: SvgReports },
        { name: t('Settings'), path: '/settings', Icon: SvgCog },
      ],
    },
    {
      title: t('Advanced'),
      items: [
        { name: t('Schedules'), path: '/schedules', Icon: SvgCalendar3 },
        { name: t('Payees'), path: '/payees', Icon: SvgStoreFront },
        { name: t('Rules'), path: '/rules', Icon: SvgTuning },
        ...(isUsingServer
          ? [{ name: t('Bank Sync'), path: '/bank-sync', Icon: SvgCreditCard }]
          : []),
      ],
    },
  ];
  const isMoreActive = moreSections.some(section =>
    section.items.some(item => pathname.startsWith(item.path)),
  );

  return (
    <nav
      aria-label={t('Main navigation')}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        alignItems: 'center',
        height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: theme.mobileNavBackground,
        borderTop: `1px solid ${theme.tableBorder}`,
      }}
    >
      <TabLink to="/overview" label={t('Overview')} icon={<OverviewIcon />} />
      <TabLink
        to="/transactions"
        end
        label={t('Transactions')}
        icon={<TransactionsIcon />}
      />
      <NavLink
        to="/transactions/quick"
        aria-label={t('Add transaction')}
        className={addButtonClass}
      >
        <PlusIcon />
      </NavLink>
      <TabLink to="/budget" label={t('Budget')} icon={<BudgetIcon />} />
      <DialogTrigger>
        <RACButton
          className={tabClass}
          style={{
            color: isMoreActive
              ? theme.mobileNavItemSelected
              : theme.mobileNavItem,
            fontWeight: isMoreActive ? 700 : 600,
          }}
        >
          <MoreIcon />
          <Trans>More</Trans>
        </RACButton>
        <ModalOverlay isDismissable className={overlayClass}>
          <Modal className={sheetClass}>
            <Dialog
              aria-label={t('More')}
              style={{
                outline: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {({ close }) =>
                moreSections.map((section, index) => (
                  <section key={section.title ?? index}>
                    {section.title && (
                      <Heading
                        level={2}
                        style={{
                          margin: '0 4px 8px',
                          fontSize: 13,
                          fontWeight: 700,
                          color: theme.pageTextSubdued,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {section.title}
                      </Heading>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 8,
                      }}
                    >
                      {section.items.map(({ name, path, Icon }) => (
                        <NavLink
                          key={path}
                          to={path}
                          onClick={close}
                          className={sheetItemClass}
                        >
                          <Icon width={22} height={22} />
                          {name}
                        </NavLink>
                      ))}
                    </div>
                  </section>
                ))
              }
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </nav>
  );
}

type MoreSection = {
  title: string | null;
  items: Array<{
    name: string;
    path: string;
    Icon: ComponentType<{
      width: number;
      height: number;
      style?: CSSProperties;
    }>;
  }>;
};

type TabLinkProps = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

function TabLink({ to, label, icon, end }: TabLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={tabClass}
      style={({ isActive }) => ({
        color: isActive ? theme.mobileNavItemSelected : theme.mobileNavItem,
        fontWeight: isActive ? 700 : 600,
      })}
    >
      {icon}
      {label}
    </NavLink>
  );
}

const tabClass = css({
  ...styles.noTapHighlight,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  height: TAB_BAR_HEIGHT,
  minWidth: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 11,
  textDecoration: 'none',
  userSelect: 'none',
  cursor: 'pointer',
  '&[data-focus-visible], &:focus-visible': {
    outline: `2px solid ${theme.mobileNavItemSelected}`,
    outlineOffset: -4,
    borderRadius: 12,
  },
});

const addButtonClass = css({
  ...styles.noTapHighlight,
  justifySelf: 'center',
  width: 56,
  height: 56,
  marginTop: -22,
  borderRadius: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.buttonPrimaryBackground,
  color: theme.buttonPrimaryText,
  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)',
  '&:active': { backgroundColor: theme.buttonPrimaryBackgroundHover },
  '&:focus-visible': {
    outline: `2px solid ${theme.mobileNavItemSelected}`,
    outlineOffset: 3,
  },
});

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

const sheetItemClass = css({
  ...styles.noTapHighlight,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 76,
  padding: '10px 4px',
  borderRadius: 16,
  backgroundColor: theme.tableBackground,
  color: theme.pageText,
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  textDecoration: 'none',
  '&.active': { color: theme.mobileNavItemSelected },
  '&:focus-visible': {
    outline: `2px solid ${theme.mobileNavItemSelected}`,
    outlineOffset: 2,
  },
});

function TabIcon({ d }: { d: string }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function BudgetIcon() {
  return <TabIcon d="M12 3a9 9 0 1 0 9 9h-9z M15 3.5A9 9 0 0 1 20.5 9H15z" />;
}

function TransactionsIcon() {
  return (
    <TabIcon d="M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01" />
  );
}

function OverviewIcon() {
  return <TabIcon d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" />;
}

function MoreIcon() {
  return <TabIcon d="M5 12h.01 M12 12h.01 M19 12h.01" />;
}

function PlusIcon() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14 M5 12h14" />
    </svg>
  );
}
