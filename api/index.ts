import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from '../server/routes';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Same global error handler as server/index.ts
const setupPromise = (async () => {
  await registerRoutes(app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    console.error(`Error ${status}:`, err);
    res.status(status).json({ message });
  });
})();

// Vercel calls this for every incoming request
export default async function handler(req: Request, res: Response) {
  await setupPromise;
  return app(req, res);
}
