import { Controller, Get, HttpCode, HttpStatus, NotImplementedException } from '@nestjs/common';

/** Contract placeholder: company membership, RBAC, and ownership-checked operations. */
@Controller({ path: 'companies', version: '1' })
export class CompaniesController {
  @Get()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  contractPlaceholder(): never {
    throw new NotImplementedException();
  }
}
