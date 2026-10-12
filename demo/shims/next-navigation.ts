export const useRouter = () => ({ push: (h: string) => window.dispatchEvent(new CustomEvent('demo:navigate', { detail: h })), refresh() {} });
export const useSearchParams = () => new URLSearchParams();
export const notFound = () => { throw new Error('not found'); };
export const redirect = notFound;
