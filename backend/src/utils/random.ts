export function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomPhone(): string {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `(${area}) ${prefix}-${line}`;
}

export function randomEmail(name: string, businessName: string): string {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', `${slug}.com`, `${slug}.io`];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const local = name.toLowerCase().replace(/\s+/g, '.');
  return `${local}@${domain}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
