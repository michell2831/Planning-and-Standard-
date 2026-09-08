import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly config: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const authHeader = req.headers['authorization'];
        const secret = this.config.get<string>('JWT_SECRET');

        // ── Primary path: behind the PSS API Gateway ────────────────────────
        // The gateway validates the token against ARMS (/auth/validate) and
        // forwards the resulting office/role/actor/cross-office info as headers.
        // This module trusts those headers — it is not directly internet-facing.
        if (req.headers['x-actor-id'] || req.headers['x-office']) {
            req.user = {
                sub: req.headers['x-actor-id'] ?? 'system',
                username: req.headers['x-actor-username'] ?? req.headers['x-actor-id'] ?? 'system',
                office: req.headers['x-office'] ?? 'unknown-office',
                role: req.headers['x-role'] ?? 'Staff',
                armsRole: req.headers['x-arms-role'] ?? req.headers['x-role'] ?? 'STAFF',
                isCrossOffice: req.headers['x-is-cross-office'] === 'true',
            };
            return true;
        }

        // ── Fallback path: a raw Bearer JWT was sent directly to this module ─
        // (e.g. local testing without going through the gateway).
        // Also handles mock tokens for dev testing directly on module ports.
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            // Mock token fallback (for dev testing or direct module deployment)
            if (token?.startsWith('mock-token-')) {
                const b64Part = token.slice('mock-token-'.length);
                let claims: Record<string, any> = {};
                try {
                    claims = JSON.parse(Buffer.from(b64Part, 'base64').toString('utf-8'));
                } catch {
                    const legacyRole = b64Part.toUpperCase();
                    const legacyMap: Record<string, Record<string, any>> = {
                        STAFF: { userId: 'mock-staff-id', username: 'mock_staff', displayName: 'Mock Staff', armsRole: 'STAFF', office: 'ACAD', isCrossOffice: false },
                        SUBSYSTEM_ADMIN: { userId: 'mock-admin-id', username: 'mock_admin', displayName: 'Mock Admin', armsRole: 'SUBSYSTEM_ADMIN', office: 'ACAD', isCrossOffice: false },
                        SUPER_ADMIN: { userId: 'mock-super-id', username: 'mock_super', displayName: 'Mock SuperAdmin', armsRole: 'SUPER_ADMIN', office: 'ALL', isCrossOffice: true },
                        OPCR_EVALUATOR: { userId: 'mock-opcr-id', username: 'mock_opcr', displayName: 'Mock OPCR', armsRole: 'OPCR_EVALUATOR', office: 'ALL', isCrossOffice: true },
                        PLANNING_OFFICER: { userId: 'mock-planner-id', username: 'mock_planner', displayName: 'Mock Planner', armsRole: 'PLANNING_OFFICER', office: 'ALL', isCrossOffice: true },
                        CAMPUS_DIRECTOR: { userId: 'mock-director-id', username: 'mock_director', displayName: 'Mock CampusDirector', armsRole: 'CAMPUS_DIRECTOR', office: 'ALL', isCrossOffice: true },
                    };
                    claims = legacyMap[legacyRole] ?? { userId: 'mock-user', username: 'mock_user', armsRole: 'STAFF', office: 'ACAD' };
                }

                const armsRole = claims.armsRole || claims.role || 'STAFF';
                const roleMap: Record<string, string> = {
                    SUPER_ADMIN: 'SuperAdmin',
                    PLANNING_OFFICER: 'PlanningOfficer',
                    SUBSYSTEM_ADMIN: 'Admin',
                    OPCR_EVALUATOR: 'OPCREvaluator',
                    STAFF: 'Staff',
                    CAMPUS_DIRECTOR: 'CampusDirector',
                };
                const officeMap: Record<string, string> = {
                    ACAD: 'Campus Academic Office',
                    OSAS: 'Campus Student Services and Affairs Office',
                    ADMIN: 'Campus Administrative Office',
                    ALL: 'ALL',
                };
                const crossOfficeRoles = new Set([
                    'SUPER_ADMIN',
                    'PLANNING_OFFICER',
                    'OPCR_EVALUATOR',
                    'CAMPUS_DIRECTOR',
                ]);

                const rawOffice = claims.office || 'ACAD';
                const resolvedOffice = officeMap[rawOffice] ?? rawOffice;
                const isCrossOffice = !!claims.isCrossOffice || crossOfficeRoles.has(armsRole) || rawOffice === 'ALL';

                req.user = {
                    sub: claims.userId || claims.sub || 'mock-user',
                    username: claims.username || 'mock_user',
                    displayName: claims.displayName || claims.username || 'Mock User',
                    office: resolvedOffice,
                    role: roleMap[armsRole] ?? 'Staff',
                    armsRole,
                    isCrossOffice,
                };
                return true;
            }

            if (!secret) {
                throw new UnauthorizedException('Missing or invalid Authorization header');
            }

            try {
                const payload = jwt.verify(token, secret) as any;
                req.user = {
                    sub: payload.sub,
                    username: payload.username ?? payload.sub,
                    office: payload.office,
                    role: payload.role || 'Staff',
                    armsRole: payload.armsRole ?? payload.role,
                    isCrossOffice: !!payload.isCrossOffice,
                };
                return true;
            } catch {
                throw new UnauthorizedException('Invalid or expired token');
            }
        }

        throw new UnauthorizedException('Missing or invalid Authorization header');
    }
}