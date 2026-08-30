declare global {
  namespace Express {
    interface Request {
      usuario?: { id: string };
    }
  }
}

export {};
