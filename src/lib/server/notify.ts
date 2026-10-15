// Server-only entry point for texts, calls and email. The logic lives in
// lib/messaging.ts so it can be unit-tested without the framework.
import 'server-only';
export { sendSms, sendEmail, callWithCode, smsConfigured, emailConfigured } from '../messaging';
