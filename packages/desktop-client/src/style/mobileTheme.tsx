import '@fontsource-variable/plus-jakarta-sans/wght.css';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { parseInstalledTheme } from './customThemes';
import mobileDarkCss from './mobile-theme/dark.css?inline';
import mobileLightCss from './mobile-theme/light.css?inline';
import mobilePaletteCss from './mobile-theme/palette.css?inline';
import { useTheme } from './theme';

/**
 * Fork-only restyle of the mobile UI. Rendered after ThemeStyle so it
 * overrides the base theme variables, and before CustomThemeStyle so an
 * installed custom theme still wins. Desktop layouts are left untouched.
 */
export function MobileThemeStyle() {
  const { isNarrowWidth } = useResponsive();
  const [activeTheme] = useTheme();
  const [installedCustomLightThemeJson] = useGlobalPref(
    'installedCustomLightTheme',
  );
  const [installedCustomDarkThemeJson] = useGlobalPref(
    'installedCustomDarkTheme',
  );

  const hasCustomTheme =
    parseInstalledTheme(installedCustomLightThemeJson) != null ||
    parseInstalledTheme(installedCustomDarkThemeJson) != null;

  if (!isNarrowWidth || hasCustomTheme) return null;

  if (activeTheme === 'auto') {
    return (
      <>
        <style>{mobilePaletteCss}</style>
        <style media="(prefers-color-scheme: light)">{mobileLightCss}</style>
        <style media="(prefers-color-scheme: dark)">{mobileDarkCss}</style>
      </>
    );
  }

  // Dark and midnight share the mobile dark sheet.
  return (
    <>
      <style>{mobilePaletteCss}</style>
      <style>{activeTheme === 'light' ? mobileLightCss : mobileDarkCss}</style>
    </>
  );
}
