import { useTranslation } from 'react-i18next';

import { MobilePageHeader, Page } from '#components/Page';

// Placeholder; the screen is built in its own pull request.
export function OverviewPage() {
  const { t } = useTranslation();
  return (
    <Page header={<MobilePageHeader title={t('Overview')} />}>{null}</Page>
  );
}
