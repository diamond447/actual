import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheveronLeft,
  SvgCheveronRight,
} from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useLocale } from '#hooks/useLocale';

type OverviewHeaderProps = {
  month: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function OverviewHeader({
  month,
  onPrevMonth,
  onNextMonth,
}: OverviewHeaderProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const rawMonthName = monthUtils.format(month, 'MMMM yyyy', locale);
  const displayMonth =
    rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  return (
    <View
      style={{
        height: 50,
        backgroundColor: theme.mobilePageBackground,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
      }}
    >
      <Button
        variant="bare"
        aria-label={t('Previous month')}
        onPress={onPrevMonth}
        style={{
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.pageText,
          padding: 0,
        }}
      >
        <SvgCheveronLeft width={22} height={22} />
      </Button>
      <h1
        style={{
          margin: 0,
          padding: 0,
          fontSize: 18,
          fontWeight: 700,
          color: theme.pageText,
          textAlign: 'center',
          flex: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {displayMonth}
      </h1>
      <Button
        variant="bare"
        aria-label={t('Next month')}
        onPress={onNextMonth}
        style={{
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.pageText,
          padding: 0,
        }}
      >
        <SvgCheveronRight width={22} height={22} />
      </Button>
    </View>
  );
}
