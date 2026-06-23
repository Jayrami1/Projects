// This file contains a utility function to catch errors in asynchronous route handlers and pass them to the express error handling middleware.
import { Request, Response, NextFunction, RequestHandler } from 'express';
//wraps around the controllers and catches their errors
export const async_catcher = (func: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(func(req, res, next)).catch(next); // converts to a promise and catches any errors, passing them to the global error middleware
  }; //eliminates the need for try-catch blocks in every controller
};
