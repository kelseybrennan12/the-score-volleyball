# Runtime Ports

## Purpose

Contracts for side-effecting reads/writes used by services and jobs.

## Allowed Contents

- Read/write repo interfaces and shared contract types.
- Transaction callback signatures.

## Rules

- Port signatures use plain value types and `Promise` return values.
- Port files do not import adapter implementation modules.
- Transaction boundary contracts are callback based.

## Good

```ts
withTransaction<T>(fn: (repos: { readRepo: ReadRepo; writeRepo: WriteRepo }) => Promise<T>): Promise<T>
```

## Bad

```ts
withTransaction<T>(fn: (tx: DrizzleDbTx) => Promise<T>): Promise<T>
```
