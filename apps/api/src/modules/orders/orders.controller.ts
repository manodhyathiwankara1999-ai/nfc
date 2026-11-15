import { Controller, Get, HttpCode, HttpStatus, NotImplementedException } from '@nestjs/common';

/** Contract placeholder: authenticated order history and signed WooCommerce webhooks. */
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  @Get()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  contractPlaceholder(): never {
    throw new NotImplementedException();
  }
}
