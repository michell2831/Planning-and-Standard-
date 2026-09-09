import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class ProxyService {
    constructor(private readonly http: HttpService) { }

    /**
     * Forwards the incoming request to a downstream PSS microservice.
     *
     * Story 2 note: responseType is 'arraybuffer' so binary report
     * downloads (PDF/CSV) pass through untouched. This is safe for the
     * existing JSON routes too — content-type is carried over as-is and
     * the raw bytes are byte-identical to the original JSON body.
     */
    async forward(req: Request, res: Response, targetBaseUrl: string): Promise<void> {
        if (!targetBaseUrl || targetBaseUrl === 'undefined') {
            throw new HttpException('Upstream microservice URL is not configured', 503);
        }

        let base = targetBaseUrl.trim().replace(/\/$/, '');
        if (!base.startsWith('http://') && !base.startsWith('https://')) {
            if (base.includes('.railway.internal') || base.includes('localhost')) {
                base = `http://${base}`;
            } else {
                base = `https://${base}`;
            }
        }

        let path = req.originalUrl;
        if (base.endsWith('/api') && path.startsWith('/api/')) {
            path = path.replace(/^\/api/, '');
        }
        const targetUrl = `${base}${path}`;

        const headers: Record<string, string> = {
            'content-type': req.headers['content-type'] as string ?? 'application/json',
        };

        if (req.user) {
            headers['x-office'] = req.user.office ?? 'unknown-office';
            headers['x-role'] = req.user.role ?? 'Admin';
            headers['x-actor-id'] = req.user.userId ?? req.user.sub ?? 'system';
            headers['x-actor-username'] = req.user.username ?? req.user.userId ?? 'system';
            headers['x-arms-role'] = req.user.armsRole ?? req.user.role ?? 'STAFF';
            headers['x-is-cross-office'] = req.user.isCrossOffice ? 'true' : 'false';
        }

        if (req.clientIp) {
            headers['x-client-ip'] = req.clientIp;
        }

        try {
            const response = await firstValueFrom(
                this.http.request({
                    method: req.method,
                    url: targetUrl,
                    data: req.body,
                    headers,
                    responseType: 'arraybuffer',
                    validateStatus: () => true,
                }),
            );

            res.status(response.status);
            const contentType = response.headers['content-type'] as string | undefined;
            if (contentType) res.setHeader('content-type', contentType);
            const contentDisposition = response.headers['content-disposition'] as string | undefined;
            if (contentDisposition) res.setHeader('content-disposition', contentDisposition);
            res.send(Buffer.from(response.data));
        } catch (err: any) {
            console.error(`[ProxyService] Error forwarding to ${targetUrl}:`, err?.message || err);
            const detail = err?.message ? ` (${err.message})` : '';
            throw new HttpException(
                `Upstream service unreachable at ${targetUrl}${detail}`,
                503,
            );
        }
    }
}