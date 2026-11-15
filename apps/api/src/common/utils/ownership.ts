import { ForbiddenException } from '@nestjs/common';

export function assertOwnership(ownerId: string, authenticatedUserId: string): void {
  if (ownerId !== authenticatedUserId) {
    throw new ForbiddenException('You do not have permission to access this resource.');
  }
}
