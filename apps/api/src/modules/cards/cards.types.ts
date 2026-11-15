import type { z } from 'zod';
import type {
  AdminCardCreateSchema,
  AdminCardSearchSchema,
  AdminCardUpdateSchema,
  AdminAuditSearchSchema,
  AdminUserSearchSchema,
  CardOfficePatchSchema,
  CardProfilePatchSchema,
  ProductCreateSchema,
  ProductReorderSchema,
  ProductUpdateSchema,
} from './cards.schemas';

export type AdminCardCreateInput = z.infer<typeof AdminCardCreateSchema>;
export type AdminCardSearchInput = z.infer<typeof AdminCardSearchSchema>;
export type AdminCardUpdateInput = z.infer<typeof AdminCardUpdateSchema>;
export type AdminAuditSearchInput = z.infer<typeof AdminAuditSearchSchema>;
export type AdminUserSearchInput = z.infer<typeof AdminUserSearchSchema>;
export type CardOfficePatchInput = z.infer<typeof CardOfficePatchSchema>;
export type CardProfilePatchInput = z.infer<typeof CardProfilePatchSchema>;
export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductReorderInput = z.infer<typeof ProductReorderSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
