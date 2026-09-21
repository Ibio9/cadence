/** Types for merge.js; see there for the rules. */

type Stamped = { id: string; at?: number; updatedAt?: number }
type Dated = { id: string; at: number }

export declare function stampOf(t: Stamped): number

export declare function mergeTodos<T extends Stamped>(
  a: { todos?: T[]; gone?: Record<string, number> },
  b: { todos?: T[]; gone?: Record<string, number> },
  now?: number,
): { todos: T[]; gone: Record<string, number> }

export declare function mergeArchive<T extends Dated>(a?: T[], b?: T[], cap?: number): T[]

export declare function mergeSeen(a?: string[], b?: string[], cap?: number): string[]
