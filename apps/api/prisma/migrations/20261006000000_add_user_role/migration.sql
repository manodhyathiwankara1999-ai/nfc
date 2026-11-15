SET search_path TO "public";
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'user';
