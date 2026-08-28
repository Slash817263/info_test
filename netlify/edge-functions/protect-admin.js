async function verifyJwt(token, secret) {
    try {
        const [headerB64, payloadB64, sigB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !sigB64) return false;
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false, ['verify']
        );
        
        function b64url2buf(b64url) {
            let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const str = atob(b64);
            const arr = new Uint8Array(str.length);
            for(let i=0; i<str.length; i++) arr[i] = str.charCodeAt(i);
            return arr;
        }
        
        const sigBuf = b64url2buf(sigB64);
        const dataBuf = encoder.encode(headerB64 + '.' + payloadB64);
        
        const valid = await crypto.subtle.verify('HMAC', key, sigBuf, dataBuf);
        if (!valid) return false;
        
        const payload = JSON.parse(new TextDecoder().decode(b64url2buf(payloadB64)));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;
        
        return true;
    } catch(e) { return false; }
}

export default async (req, context) => {
    const url = new URL(req.url);

    const isAdminPage = url.pathname.startsWith('/admin.html') || url.pathname.startsWith('/assets/js/admin.js') || url.pathname.startsWith('/assets/css/admin.css');
    
    // We want to intercept admin API routes too to inject the header from cookie
    const adminApiRoutes = [
        '/_utils', 'upload-image', 'update-phone', 'manage-', 'fetch-', 'delete-result', 'send-report-email'
    ];
    const isApiRoute = url.pathname.startsWith('/.netlify/functions/') && adminApiRoutes.some(route => url.pathname.includes(route));

    if (isAdminPage || isApiRoute) {
        const cookieHeader = req.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        const expectedSecret = (typeof Netlify !== 'undefined' && Netlify.env && Netlify.env.get("ADMIN_SECRET")) ||
                               (typeof Deno !== 'undefined' && Deno.env && Deno.env.get("ADMIN_SECRET")) || '';

        let isValid = false;
        if (token && expectedSecret) {
            if (token === expectedSecret) {
                isValid = true;
            } else {
                isValid = await verifyJwt(token, expectedSecret);
            }
        }

        // Validate token
        if (!isValid) {
            if (isAdminPage) {
                return new Response(null, {
                    status: 302,
                    headers: {
                        Location: '/admin-login.html',
                        'Cache-Control': 'no-cache, no-store, must-revalidate'
                    }
                });
            } else {
                // If API route and token is invalid, strip any client-supplied header to prevent spoofing
                const headers = new Headers(req.headers);
                headers.delete('x-admin-token');
                headers.delete('X-Admin-Token');
                return context.next(new Request(req, { headers }));
            }
        }
        
        // Token is valid! Inject the expected secret for Node functions
        if (isApiRoute) {
            const headers = new Headers(req.headers);
            headers.set('x-admin-token', expectedSecret);
            return context.next(new Request(req, { headers }));
        }

        return context.next();
    }

    return context.next();
};
