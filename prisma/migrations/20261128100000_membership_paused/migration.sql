-- An admin can pause a membership: billing stops and the member discount is withdrawn, but the record is kept.
ALTER TYPE "CustomerSignupStatus" ADD VALUE 'paused';
