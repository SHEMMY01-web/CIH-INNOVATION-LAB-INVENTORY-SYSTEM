/**
 * ASD-STE100 (Simplified Technical English) Error Formatting Module
 * 
 * Complies with ASD-STE100 principles:
 * - Simple, approved, controlled vocabulary.
 * - Short, unambiguous sentences (maximum 20 words for instructions).
 * - Clear 3-part structure: Problem (Condition), Cause, and Action.
 * - No technical jargon, raw stack traces, or developer acronyms (e.g. JWT, PGRST, CORS, RLS).
 */
import { supabase } from '../lib/supabase';

/**
 * Categorizes and formats any application or database error into ASD-STE100 format.
 *
 * @param {Error|string|object} rawError - The captured error or message
 * @param {string} [context=''] - Optional context (e.g., 'dashboard metrics', 'inventory items')
 * @returns {object} Formatted STE error object
 */
export function formatSteError(rawError, context = '') {
  let rawText = '';
  let errorCode = '';

  if (typeof rawError === 'string') {
    rawText = rawError;
  } else if (rawError && typeof rawError === 'object') {
    rawText = rawError.message || rawError.error_description || rawError.details || JSON.stringify(rawError);
    errorCode = rawError.code || rawError.status || '';
  }

  const normalized = (rawText + ' ' + context).toLowerCase();

  // Determine specific entity/action context
  let entity = 'requested data';
  if (normalized.includes('dashboard')) entity = 'dashboard metrics';
  else if (normalized.includes('project')) entity = 'project information';
  else if (normalized.includes('item') || normalized.includes('inventory')) entity = 'inventory items';
  else if (normalized.includes('tool')) entity = 'tool information';
  else if (normalized.includes('asset')) entity = 'asset records';
  else if (normalized.includes('requisition') || normalized.includes('request')) entity = 'equipment requisition';
  else if (normalized.includes('image') || normalized.includes('upload')) entity = 'image file';

  // 1. JWT Issued At Future / System Clock Skew Error
  if (
    normalized.includes('jwt issued at future') ||
    normalized.includes('issued at future') ||
    normalized.includes('iat') ||
    (normalized.includes('future') && normalized.includes('jwt')) ||
    (normalized.includes('future') && normalized.includes('token'))
  ) {
    return {
      title: 'System Time Error',
      problem: `The system cannot load the ${entity}.`,
      cause: 'Your device clock does not match the server time. The security token has a future timestamp.',
      action: 'Set your device clock to the correct date and time. Then sign out and sign in again.',
      actionType: 'relogin',
      actionButtonText: 'Sign In Again',
      rawTechnical: rawText,
      formattedText: [
        `Problem: The system cannot load the ${entity}.`,
        'Cause: Your device clock does not match the server time. The security token has a future timestamp.',
        'Action: Set your device clock to the correct date and time. Then sign out and sign in again.'
      ].join('\n\n'),
      onAction: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    };
  }

  // 2. JWT Expired / Token Expired
  if (
    normalized.includes('jwt expired') ||
    normalized.includes('token expired') ||
    normalized.includes('invalid claim: exp') ||
    normalized.includes('session expired') ||
    errorCode === 'PGRST301'
  ) {
    return {
      title: 'Session Expired',
      problem: 'Your login session is no longer active.',
      cause: 'The security token has expired.',
      action: 'Sign in again to continue your work.',
      actionType: 'relogin',
      actionButtonText: 'Sign In Again',
      rawTechnical: rawText,
      formattedText: [
        'Problem: Your login session is no longer active.',
        'Cause: The security token has expired.',
        'Action: Sign in again to continue your work.'
      ].join('\n\n'),
      onAction: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    };
  }

  // 3. Network & Connection Failures
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('err_connection') ||
    normalized.includes('err_name_not_resolved') ||
    normalized.includes('offline') ||
    normalized.includes('aborterror')
  ) {
    return {
      title: 'Connection Error',
      problem: 'The application cannot communicate with the server.',
      cause: 'Your device is offline or the network connection was interrupted.',
      action: 'Check your internet connection and reload the page.',
      actionType: 'reload',
      actionButtonText: 'Reload Page',
      rawTechnical: rawText,
      formattedText: [
        'Problem: The application cannot communicate with the server.',
        'Cause: Your device is offline or the network connection was interrupted.',
        'Action: Check your internet connection and reload the page.'
      ].join('\n\n'),
      onAction: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    };
  }

  // 4. Permissions & Row Level Security
  if (
    normalized.includes('permission denied') ||
    normalized.includes('row-level security') ||
    normalized.includes('insufficient_privilege') ||
    normalized.includes('not authorized') ||
    errorCode === '42501' ||
    errorCode === 403
  ) {
    return {
      title: 'Access Denied',
      problem: `Cannot view or modify the ${entity}.`,
      cause: 'Your account does not have administrator permissions for this operation.',
      action: 'Contact the laboratory administrator to request permission.',
      actionType: 'dismiss',
      actionButtonText: 'Understood',
      rawTechnical: rawText,
      formattedText: [
        `Problem: Cannot view or modify the ${entity}.`,
        'Cause: Your account does not have administrator permissions for this operation.',
        'Action: Contact the laboratory administrator to request permission.'
      ].join('\n\n')
    };
  }

  // 5. Unique Key / Duplicate Entry Constraint
  if (
    normalized.includes('duplicate key') ||
    normalized.includes('unique constraint') ||
    normalized.includes('already exists') ||
    errorCode === '23505'
  ) {
    return {
      title: 'Duplicate Entry',
      problem: 'Cannot save this record.',
      cause: 'A record with this name or identification code already exists in the database.',
      action: 'Enter a different name or reference code, then submit the form again.',
      actionType: 'dismiss',
      actionButtonText: 'Got It',
      rawTechnical: rawText,
      formattedText: [
        'Problem: Cannot save this record.',
        'Cause: A record with this name or identification code already exists in the database.',
        'Action: Enter a different name or reference code, then submit the form again.'
      ].join('\n\n')
    };
  }

  // 6. Foreign Key / Dependent Record Constraint
  if (
    normalized.includes('foreign key') ||
    normalized.includes('violates foreign key') ||
    normalized.includes('is still referenced') ||
    errorCode === '23503'
  ) {
    return {
      title: 'Dependent Record Error',
      problem: 'Cannot delete or modify this record.',
      cause: 'Other active projects or requisitions link to this item.',
      action: 'Remove the linked project or requisition records before you delete this item.',
      actionType: 'dismiss',
      actionButtonText: 'Got It',
      rawTechnical: rawText,
      formattedText: [
        'Problem: Cannot delete or modify this record.',
        'Cause: Other active projects or requisitions link to this item.',
        'Action: Remove the linked project or requisition records before you delete this item.'
      ].join('\n\n')
    };
  }

  // 7. Insufficient Stock
  if (
    normalized.includes('insufficient stock') ||
    normalized.includes('only') && normalized.includes('available in lab')
  ) {
    return {
      title: 'Insufficient Stock',
      problem: 'Cannot approve this equipment requisition.',
      cause: 'The requested quantity is greater than the available laboratory stock.',
      action: 'Reduce the requested quantity or wait for incoming shipments.',
      actionType: 'dismiss',
      actionButtonText: 'Understood',
      rawTechnical: rawText,
      formattedText: [
        'Problem: Cannot approve this equipment requisition.',
        'Cause: The requested quantity is greater than the available laboratory stock.',
        'Action: Reduce the requested quantity or wait for incoming shipments.'
      ].join('\n\n')
    };
  }

  // 8. Image & Media Storage Upload
  if (
    normalized.includes('storage bucket') ||
    normalized.includes('image upload') ||
    normalized.includes('payload too large') ||
    normalized.includes('process image file') ||
    errorCode === 413
  ) {
    return {
      title: 'Image Upload Error',
      problem: 'Cannot upload the image file.',
      cause: 'The image file exceeds the size limit or the storage service is busy.',
      action: 'Select a JPG or PNG image smaller than 5 megabytes and try again.',
      actionType: 'dismiss',
      actionButtonText: 'Try Again',
      rawTechnical: rawText,
      formattedText: [
        'Problem: Cannot upload the image file.',
        'Cause: The image file exceeds the size limit or the storage service is busy.',
        'Action: Select a JPG or PNG image smaller than 5 megabytes and try again.'
      ].join('\n\n')
    };
  }

  // 9. Rate Limiting / Too Many Attempts
  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('too many login attempts') ||
    errorCode === 429
  ) {
    return {
      title: 'Too Many Attempts',
      problem: 'The system blocked your request temporarily.',
      cause: 'The system received too many requests in a short period.',
      action: 'Wait 60 seconds before you submit your request again.',
      actionType: 'dismiss',
      actionButtonText: 'Understood',
      rawTechnical: rawText,
      formattedText: [
        'Problem: The system blocked your request temporarily.',
        'Cause: The system received too many requests in a short period.',
        'Action: Wait 60 seconds before you submit your request again.'
      ].join('\n\n')
    };
  }

  // 10. Database Schema or Query Failure
  if (
    normalized.includes('relation') && normalized.includes('does not exist') ||
    normalized.includes('column') && normalized.includes('does not exist') ||
    normalized.includes('database error') ||
    normalized.includes('pgrst')
  ) {
    return {
      title: 'Database Error',
      problem: `Cannot retrieve the ${entity}.`,
      cause: 'The system database is temporarily unavailable or misconfigured.',
      action: 'Reload the page. If the problem continues, contact technical support.',
      actionType: 'reload',
      actionButtonText: 'Reload Page',
      rawTechnical: rawText,
      formattedText: [
        `Problem: Cannot retrieve the ${entity}.`,
        'Cause: The system database is temporarily unavailable or misconfigured.',
        'Action: Reload the page. If the problem continues, contact technical support.'
      ].join('\n\n'),
      onAction: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    };
  }

  // 11. General Fallback
  return {
    title: 'Operation Error',
    problem: `Cannot complete the operation for the ${entity}.`,
    cause: 'An unexpected system error occurred.',
    action: 'Reload the page and try again. If the problem continues, contact technical support.',
    actionType: 'dismiss',
    actionButtonText: 'Dismiss',
    rawTechnical: rawText,
    formattedText: [
      `Problem: Cannot complete the operation for the ${entity}.`,
      'Cause: An unexpected system error occurred.',
      'Action: Reload the page and try again. If the problem continues, contact technical support.'
    ].join('\n\n')
  };
}
