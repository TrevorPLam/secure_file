// AI-META-BEGIN
// AI-META: Object storage module barrel export - provides GCS client, ACL policies, and route registration
// OWNERSHIP: server/replit_integrations/object_storage
// ENTRYPOINTS: Imported by server/routes.ts for object storage setup
// DEPENDENCIES: ./objectStorage (ObjectStorageService, client), ./objectAcl (ACL policy management), ./routes (route registration)
// DANGER: Barrel file - keep exports stable to avoid circular dependencies
// CHANGE-SAFETY: Safe to add new exports, unsafe to rename or remove existing exports without auditing all importers
// TESTS: Run `npm run check` for type safety
// AI-META-END

export {
  ObjectStorageService,
  ObjectNotFoundError,
  objectStorageClient,
} from "./objectStorage";

export type {
  ObjectAclPolicy,
  ObjectAccessGroup,
  ObjectAccessGroupType,
  ObjectAclRule,
} from "./objectAcl";

export {
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export { registerObjectStorageRoutes } from "./routes";

