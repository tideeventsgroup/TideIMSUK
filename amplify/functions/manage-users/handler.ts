import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminDeleteUserCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

// The four Tide roles (auth/resource.ts groups) — a user belongs to exactly
// one at a time, so changing role means leaving whichever of these they're
// currently in before joining the new one.
const ROLE_GROUPS = ['event-control', 'fmic', 'staff', 'view-only'];

interface AppSyncEvent {
  info: { fieldName: string };
  arguments: Record<string, string>;
  identity?: { sub?: string };
}

function attr(user: UserType, name: string): string | undefined {
  return user.Attributes?.find((a) => a.Name === name)?.Value;
}

async function roleForUser(username: string): Promise<string | undefined> {
  const { Groups } = await cognito.send(
    new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
  );
  return Groups?.map((g) => g.GroupName).find((name) => name && ROLE_GROUPS.includes(name));
}

async function toAppUser(user: UserType) {
  const role = await roleForUser(user.Username!);
  return {
    sub: user.Username!,
    email: attr(user, 'email') ?? '',
    name: attr(user, 'name') ?? '',
    role: role ?? null,
    enabled: user.Enabled ?? false,
    status: user.UserStatus ?? 'UNKNOWN',
  };
}

async function listAppUsers() {
  const users: UserType[] = [];
  let PaginationToken: string | undefined;
  do {
    const res = await cognito.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID, PaginationToken }));
    users.push(...(res.Users ?? []));
    PaginationToken = res.PaginationToken;
  } while (PaginationToken);
  return Promise.all(users.map(toAppUser));
}

async function createAppUser(args: { email: string; name: string; role: string }) {
  if (!ROLE_GROUPS.includes(args.role)) throw new Error(`Unknown role: ${args.role}`);
  const { User } = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: args.email,
      UserAttributes: [
        { Name: 'email', Value: args.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: args.name },
      ],
      // Default message action — Cognito emails the new user a temporary
      // password; the Authenticator's built-in NEW_PASSWORD_REQUIRED
      // screen handles the forced change on first sign-in.
    }),
  );
  await cognito.send(
    new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: args.email, GroupName: args.role }),
  );
  return toAppUser(User!);
}

async function updateAppUserRole(args: { sub: string; role: string }) {
  if (!ROLE_GROUPS.includes(args.role)) throw new Error(`Unknown role: ${args.role}`);
  const { Groups } = await cognito.send(
    new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: args.sub }),
  );
  for (const group of Groups ?? []) {
    if (group.GroupName && ROLE_GROUPS.includes(group.GroupName) && group.GroupName !== args.role) {
      await cognito.send(
        new AdminRemoveUserFromGroupCommand({ UserPoolId: USER_POOL_ID, Username: args.sub, GroupName: group.GroupName }),
      );
    }
  }
  if (!Groups?.some((g) => g.GroupName === args.role)) {
    await cognito.send(
      new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: args.sub, GroupName: args.role }),
    );
  }
  const { Users } = await cognito.send(
    new ListUsersCommand({ UserPoolId: USER_POOL_ID, Filter: `sub = "${args.sub}"` }),
  );
  return toAppUser(Users![0]);
}

async function deleteAppUser(args: { sub: string }, callerSub?: string) {
  if (args.sub === callerSub) throw new Error('You cannot remove your own account.');
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: args.sub }));
  return true;
}

export const handler = async (event: AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'listAppUsers':
      return listAppUsers();
    case 'createAppUser':
      return createAppUser(event.arguments as { email: string; name: string; role: string });
    case 'updateAppUserRole':
      return updateAppUserRole(event.arguments as { sub: string; role: string });
    case 'deleteAppUser':
      return deleteAppUser(event.arguments as { sub: string }, event.identity?.sub);
    default:
      throw new Error(`Unknown field: ${event.info.fieldName}`);
  }
};
