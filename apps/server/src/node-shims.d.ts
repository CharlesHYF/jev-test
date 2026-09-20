declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};

declare const Buffer: {
  from(value: ArrayBufferView | string): Uint8Array;
};

declare module "node:http" {
  const http: any;
  export default http;
}

declare module "node:fs" {
  export const readFileSync: any;
  export const existsSync: any;
  export const createReadStream: any;
  export const statSync: any;
}

declare module "node:path" {
  const path: any;
  export default path;
}

declare module "node:url" {
  export const fileURLToPath: any;
}

declare module "node:perf_hooks" {
  export const performance: Performance;
}
