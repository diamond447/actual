// The fork replaces upstream's swipe-up nav sheet with a fixed tab bar; this
// module keeps the upstream import path so callers stay unchanged.
import { MobileTabBar } from './MobileTabBar';

export { MOBILE_NAV_HEIGHT } from './MobileTabBar';

export function MobileNavTabs() {
  return <MobileTabBar />;
}
