import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOnboardingRedirect } from './useOnboardingRedirect';

const mockNavigate = vi.fn();
let mockIsNarrowWidth = true;
let mockAccountsState = {
  data: [] as unknown[],
  isSuccess: true,
  isPlaceholderData: false,
};
let mockOnboardingCompleted: string | undefined = undefined;

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: mockIsNarrowWidth }),
}));

vi.mock('#hooks/useNavigate', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('#hooks/useAccounts', () => ({
  useAccounts: () => mockAccountsState,
}));

vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: () => [mockOnboardingCompleted, vi.fn()],
}));

describe('useOnboardingRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNarrowWidth = true;
    mockAccountsState = {
      data: [],
      isSuccess: true,
      isPlaceholderData: false,
    };
    mockOnboardingCompleted = undefined;
  });

  it('redirects to /welcome when accounts are loaded, empty, and onboarding not completed', () => {
    const { result } = renderHook(() => useOnboardingRedirect());

    expect(result.current.shouldRedirect).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('/welcome', { replace: true });
  });

  it('does NOT redirect while accounts are still loading (placeholder data)', () => {
    mockAccountsState = {
      data: [],
      isSuccess: true,
      isPlaceholderData: true,
    };

    const { result } = renderHook(() => useOnboardingRedirect());

    expect(result.current.shouldRedirect).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT redirect if query is not successful yet', () => {
    mockAccountsState = {
      data: [],
      isSuccess: false,
      isPlaceholderData: false,
    };

    const { result } = renderHook(() => useOnboardingRedirect());

    expect(result.current.shouldRedirect).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT redirect if accounts already exist', () => {
    mockAccountsState = {
      data: [{ id: 'acc-1', name: 'Checking' }],
      isSuccess: true,
      isPlaceholderData: false,
    };

    const { result } = renderHook(() => useOnboardingRedirect());

    expect(result.current.shouldRedirect).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT redirect if onboarding-completed is "true"', () => {
    mockOnboardingCompleted = 'true';

    const { result } = renderHook(() => useOnboardingRedirect());

    expect(result.current.shouldRedirect).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT redirect on wide screens', () => {
    mockIsNarrowWidth = false;

    const { result } = renderHook(() => useOnboardingRedirect());

    expect(result.current.shouldRedirect).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
