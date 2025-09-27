declare module 'express' {
  const express: any;
  export default express;
  export type Request = any;
  export type Response = any;
  export type NextFunction = any;
}

declare module 'zod' {
  export const z: any;
}

declare module 'node:crypto' {
  export function randomUUID(): string;
}

declare module 'node:events' {
  export class EventEmitter {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    off?(event: string | symbol, listener?: (...args: any[]) => void): this;
    emit(event: string | symbol, ...args: any[]): boolean;
  }
}

declare const process: any;
