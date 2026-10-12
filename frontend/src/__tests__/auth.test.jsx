import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { api, getStoredTokens, setStoredTokens, clearStoredTokens } from '../api/client';
import Login from '../pages/auth/Login';

// Helper component to test useAuth hook values
function AuthConsumer() {
  const { user, isAuthenticated, role, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-role">{role || 'none'}</div>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}

describe('Authentication & Token Management', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages tokens correctly with safe storage fallback', () => {
    setStoredTokens('test-access-token', 'test-refresh-token');
    const tokens = getStoredTokens();
    expect(tokens.access).toBe('test-access-token');
    expect(tokens.refresh).toBe('test-refresh-token');

    clearStoredTokens();
    const cleared = getStoredTokens();
    expect(cleared.access).toBeNull();
    expect(cleared.refresh).toBeNull();
  });

  it('renders Login form and accepts credentials input', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    expect(usernameInput).toBeDefined();
    expect(passwordInput).toBeDefined();

    fireEvent.change(usernameInput, { target: { value: 'cbe_customer' } });
    fireEvent.change(passwordInput, { target: { value: 'Pass1234!' } });

    expect(usernameInput.value).toBe('cbe_customer');
    expect(passwordInput.value).toBe('Pass1234!');
  });

  it('updates AuthContext state when credentials are provided', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ id: '1', username: 'cbe_customer', role: 'CUSTOMER' });
    setStoredTokens('access', 'refresh');
    localStorage.setItem(
      'mw_user_data',
      JSON.stringify({ id: '1', username: 'cbe_customer', role: 'CUSTOMER' })
    );

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    expect(screen.getByTestId('user-role').textContent).toBe('CUSTOMER');

    await act(async () => {
      fireEvent.click(screen.getByText('Sign Out'));
    });
    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('user-role').textContent).toBe('none');
  });
});
