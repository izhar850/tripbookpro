'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    super(`FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.vh({
  method: context.operation,
  path: context.path,
  request: { resource: { data: context.requestResourceData } }
})}`);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}

// Minimal helper to avoid complex stringification if needed
const JSON = {
  vh: (obj: any) => globalThis.JSON.stringify(obj, null, 2)
};
