import { Prisma, PrismaClient, UserStatus } from '@prisma/client';
import { hashPassword, verifyPassword } from '../lib/password.js';

const ADMIN_ROLE_CODE = 'admin';
const ADMIN_PERMISSION_CODES = [
    'catalogs:read',
    'catalogs:write',
    'uploads:write',
    'articles:write',
    'articles:import',
    'invoices:read',
    'invoices:write',
    'invoices:export'
] as const;

type AuthPrismaClient = PrismaClient | Prisma.TransactionClient;

export type AuthenticatedIdentity = {
    userId: string;
    username: string;
    role: 'admin';
    roles: string[];
    scopes: string[];
};

type AuthenticateInput = {
    username: string;
    password: string;
    bootstrapUsername?: string;
    bootstrapPassword?: string;
};

const getUserWithRelations = (prisma: AuthPrismaClient, username: string) => prisma.user.findUnique({
    where: { username },
    include: {
        roles: {
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
                }
            }
        }
    });

const toIdentity = (user: Awaited<ReturnType<typeof getUserWithRelations>>): AuthenticatedIdentity | null => {
    if (!user || user.status !== UserStatus.ACTIVE) {
        return null;
    }

    const roles = user.roles.map((entry) => entry.role.code);
    const scopes = Array.from(new Set(user.roles.flatMap((entry) => entry.role.permissions.map((permission) => permission.permission.code)))).sort();

    return {
        userId: user.id,
        username: user.username,
        role: 'admin',
        roles: roles.length ? roles : [ADMIN_ROLE_CODE],
        scopes
    };
};

const ensureBootstrapAdminUser = async (prisma: PrismaClient, username: string, password: string) => {
    const passwordHash = await hashPassword(password);

    return prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
            where: { code: ADMIN_ROLE_CODE },
            update: {
                name: 'Administrator',
                description: 'Bootstrap administrator role'
            },
            create: {
                code: ADMIN_ROLE_CODE,
                name: 'Administrator',
                description: 'Bootstrap administrator role'
            }
        });

        for (const code of ADMIN_PERMISSION_CODES) {
            const permission = await tx.permission.upsert({
                where: { code },
                update: {
                    description: `Bootstrap permission ${code}`
                },
                create: {
                    code,
                    description: `Bootstrap permission ${code}`
                }
            });

            await tx.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId: permission.id
                }
            });
        }

        const user = await tx.user.upsert({
            where: { username },
            update: {
                passwordHash,
                status: UserStatus.ACTIVE,
                isBootstrap: true,
                displayName: 'Bootstrap Admin'
            },
            create: {
                username,
                passwordHash,
                status: UserStatus.ACTIVE,
                isBootstrap: true,
                displayName: 'Bootstrap Admin'
            }
        });

        await tx.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: user.id,
                    roleId: role.id
                }
            },
            update: {},
            create: {
                userId: user.id,
                roleId: role.id
            }
        });

        return getUserWithRelations(tx, username);
    });
};

export class AuthService {
    constructor(private readonly prisma: PrismaClient) {}

    async authenticate(input: AuthenticateInput): Promise<AuthenticatedIdentity | null> {
        const username = input.username.trim();
        const password = input.password;
        if (!username || !password) {
            return null;
        }

        const existingUser = await getUserWithRelations(this.prisma, username);
        if (existingUser?.status === UserStatus.ACTIVE) {
            const matches = await verifyPassword(password, existingUser.passwordHash);
            if (matches) {
                return toIdentity(existingUser);
            }
        }

        if (username === input.bootstrapUsername && password === input.bootstrapPassword) {
            const bootstrapUser = await ensureBootstrapAdminUser(this.prisma, username, password);
            return toIdentity(bootstrapUser);
        }

        return null;
    }
}
