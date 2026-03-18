import assert from 'node:assert/strict';
import { AuthService } from '../src/services/authService.js';
import { issueAuthToken } from '../src/middlewares/auth.js';

const users = new Map<string, any>();
const roles = new Map<string, any>();
const permissions = new Map<string, any>();
const userRoles = new Map<string, any>();
const rolePermissions = new Map<string, any>();

const loadUser = (username: string) => {
    const user = users.get(username);
    if (!user) return null;

    const attachedRoles = Array.from(userRoles.values())
        .filter((entry) => entry.userId === user.id)
        .map((entry) => {
            const role = roles.get(entry.roleId);
            const attachedPermissions = Array.from(rolePermissions.values())
                .filter((permissionEntry) => permissionEntry.roleId === role.id)
                .map((permissionEntry) => ({
                    permission: permissions.get(permissionEntry.permissionId)
                }));

            return {
                role: {
                    ...role,
                    permissions: attachedPermissions
                }
            };
        });

    return {
        ...user,
        roles: attachedRoles
    };
};

const mockPrisma = {
    user: {
        findUnique: async ({ where }: any) => loadUser(where.username),
        upsert: async ({ where, update, create }: any) => {
            const existing = users.get(where.username);
            const next = existing ? { ...existing, ...update } : { id: `user-${users.size + 1}`, ...create };
            users.set(next.username, next);
            return next;
        }
    },
    role: {
        upsert: async ({ where, update, create }: any) => {
            const existing = roles.get(where.code);
            const next = existing ? { ...existing, ...update } : { id: `role-${roles.size + 1}`, ...create };
            roles.set(next.code ?? where.code, next);
            roles.set(next.id, next);
            return next;
        }
    },
    permission: {
        upsert: async ({ where, update, create }: any) => {
            const existing = permissions.get(where.code);
            const next = existing ? { ...existing, ...update } : { id: `permission-${permissions.size + 1}`, ...create };
            permissions.set(next.code ?? where.code, next);
            permissions.set(next.id, next);
            return next;
        }
    },
    userRole: {
        upsert: async ({ where, create }: any) => {
            const key = `${where.userId_roleId.userId}:${where.userId_roleId.roleId}`;
            if (!userRoles.has(key)) {
                userRoles.set(key, { ...create });
            }
            return userRoles.get(key);
        }
    },
    rolePermission: {
        upsert: async ({ where, create }: any) => {
            const key = `${where.roleId_permissionId.roleId}:${where.roleId_permissionId.permissionId}`;
            if (!rolePermissions.has(key)) {
                rolePermissions.set(key, { ...create });
            }
            return rolePermissions.get(key);
        }
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)
} as any;

const run = async () => {
    const authService = new AuthService(mockPrisma);

    const identity = await authService.authenticate({
        username: 'admin',
        password: 'contract-password',
        bootstrapUsername: 'admin',
        bootstrapPassword: 'contract-password'
    });

    assert.ok(identity, 'bootstrap admin should authenticate');
    assert.equal(identity?.username, 'admin');
    assert.equal(identity?.role, 'admin');
    assert.ok(identity?.roles.includes('admin'));
    assert.ok(identity?.scopes.includes('articles:import'));

    const secondIdentity = await authService.authenticate({
        username: 'admin',
        password: 'contract-password',
        bootstrapUsername: 'admin',
        bootstrapPassword: 'contract-password'
    });

    assert.ok(secondIdentity, 'persisted user should authenticate from DB hash');

    const token = await issueAuthToken({
        userId: identity!.userId,
        sub: identity!.username,
        username: identity!.username,
        role: 'admin',
        roles: identity!.roles,
        scopes: identity!.scopes
    }, 'contract-secret');

    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(payload.sub, 'admin');
    assert.equal(payload.role, 'admin');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.username, 'admin');
    assert.equal(typeof payload.uid, 'string');

    console.log('verify-auth-evolution passed');
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
