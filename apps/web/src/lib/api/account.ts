import type { AccountDetails, AccountDetailsUpdate } from '@nfc/shared';
import { apiRequest } from './client';

export function getMyAccount(): Promise<AccountDetails> {
  return apiRequest<AccountDetails>('/users/me/account');
}

export function updateMyAccount(details: AccountDetailsUpdate): Promise<AccountDetails> {
  return apiRequest<AccountDetails>('/users/me/account', {
    method: 'PATCH',
    body: JSON.stringify(details),
  });
}
