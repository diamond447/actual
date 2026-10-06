import { Navigate } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { LoadComponent } from '#components/util/LoadComponent';

import type * as ForkScreens from './forkScreens';

const loadForkScreens = () =>
  import(/* webpackChunkName: "fork-mobile-screens" */ './forkScreens');

type ForkMobileScreenProps = {
  name: keyof typeof ForkScreens;
  /** Where wide screens go instead; these screens are mobile-only. */
  wideFallback: string;
};

export function ForkMobileScreen({
  name,
  wideFallback,
}: ForkMobileScreenProps) {
  const { isNarrowWidth } = useResponsive();
  if (!isNarrowWidth) {
    return <Navigate to={wideFallback} replace />;
  }
  return <LoadComponent name={name} importer={loadForkScreens} />;
}
